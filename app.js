import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAX9brFVKMB_e6tdhzZcD6p3G8sXCjPIVs",
  authDomain: "miappgastos-824aa.firebaseapp.com",
  projectId: "miappgastos-824aa",
  storageBucket: "miappgastos-824aa.firebasestorage.app",
  messagingSenderId: "88306124090",
  appId: "1:88306124090:web:66d278ff6e23a2edae3c03",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const auth = getAuth(app);
const provider = new GoogleAuthProvider();
let usuarioActual = null; // Aquí guardaremos quién está usando la app

// Seleccionamos los elementos HTML
const formulario = document.getElementById("formulario-gastos");
const inputMonto = document.getElementById("monto");
const inputCategoria = document.getElementById("categoria");
const inputFecha = document.getElementById("fecha");
const listaGastos = document.getElementById("lista-gastos");
const elementoTotal = document.getElementById("total-mes");
const inputMesFiltro = document.getElementById("mes-filtro");
const divResumenCategorias = document.getElementById("resumen-categorias");
const inputSueldo = document.getElementById("sueldo-input");
const btnSueldo = document.getElementById("btn-guardar-sueldo");
const elementoSaldo = document.getElementById("saldo-disponible");

let graficoVisual = null;

// Ponemos el mes actual por defecto
const fechaHoy = new Date();
const mesActualString = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, "0")}`;
inputMesFiltro.value = mesActualString;

// Recargar al cambiar de mes
inputMesFiltro.addEventListener("change", cargarGastosDesdeFirebase);

const seccionLogin = document.getElementById("pantalla-login");
const seccionApp = document.getElementById("app-principal");
const btnIngresar = document.getElementById("btn-ingresar-google");

// Al poner la función directamente adentro del clic, los navegadores no la bloquean
btnIngresar.addEventListener("click", function () {
  signInWithPopup(auth, provider)
    .then((resultado) => {
      console.log("¡Sesión iniciada con éxito!", resultado.user.displayName);
      // No necesitamos hacer nada más aquí, el onAuthStateChanged se encargará de mostrar la app
    })
    .catch((error) => {
      console.error("Error al iniciar sesión:", error);
      alert("Hubo un error: " + error.message); // Esto nos dirá exactamente qué falla si hay un problema
    });
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Si hay usuario, guardamos sus datos y cargamos su info
    usuarioActual = user;
    seccionLogin.style.display = "none"; // Ocultamos login
    seccionApp.style.display = "block"; // Mostramos la app
    cargarGastosDesdeFirebase();
  } else {
    // Si no hay usuario, mandamos a loguear
    usuarioActual = null;
    seccionLogin.style.display = "block"; // Mostramos login
    seccionApp.style.display = "none"; // Ocultamos la app
  }
});

// async function iniciarSesion() {
//   try {
//     await signInWithRedirect(auth, provider);
//   } catch (error) {
//     console.error("Error al iniciar sesión:", error);
//     alert("No se pudo iniciar sesión. Revisa si el popup fue bloqueado.");
//   }
// }

// --- EVENTO: GUARDAR SUELDO ---
btnSueldo.addEventListener("click", async () => {
  const monto = parseFloat(inputSueldo.value);
  const mesSeleccionado = inputMesFiltro.value;
  if (!isNaN(monto) && mesSeleccionado) {
    await addDoc(collection(db, "presupuestos"), {
      mes: mesSeleccionado,
      monto: monto,
      fechaCreacion: new Date(),
      autorId: usuarioActual.uid,
    });
    alert("Sueldo de " + mesSeleccionado + " guardado.");
    cargarGastosDesdeFirebase();
  }
});

// --- EVENTO: GUARDAR GASTO ---
formulario.addEventListener("submit", async function (evento) {
  evento.preventDefault();

  const monto = parseFloat(inputMonto.value);
  const categoria = inputCategoria.value;
  const fecha = inputFecha.value;

  try {
    await addDoc(collection(db, "gastos"), {
      monto: monto,
      categoria: categoria,
      fecha: fecha,
      autorId: usuarioActual.uid, // <--- LA ETIQUETA MÁGICA
      creadoEn: new Date(),
    });

    formulario.reset();
    cargarGastosDesdeFirebase();
  } catch (error) {
    console.error("Error al guardar en Firebase: ", error);
    alert("Hubo un problema al guardar el gasto.");
  }
});

// --- FUNCIÓN PRINCIPAL: LEER Y CALCULAR ---
async function cargarGastosDesdeFirebase() {
  try {
    // Si no hay nadie logueado, cortamos la ejecución por seguridad
    if (!usuarioActual) return;

    const mesActual = inputMesFiltro.value;

    // --- 1. CALCULAR MES PASADO PARA EL ARRASTRE ---
    const fechaAux = new Date(mesActual + "-01");
    fechaAux.setMonth(fechaAux.getMonth() - 1);
    const mesPasado = `${fechaAux.getFullYear()}-${String(fechaAux.getMonth() + 1).padStart(2, "0")}`;

    // --- 2. PEDIMOS A FIREBASE SOLO NUESTROS DATOS (Seguridad total) ---
    const consultaGastos = query(
      collection(db, "gastos"),
      where("autorId", "==", usuarioActual.uid),
    );
    const todosLosGastos = await getDocs(consultaGastos);

    const consultaSueldos = query(
      collection(db, "presupuestos"),
      where("autorId", "==", usuarioActual.uid),
    );
    const todosLosSueldos = await getDocs(consultaSueldos);

    let sueldoMesActual = 0;
    let saldoAnterior = 0;
    let gastosMesPasado = 0;
    let sueldoMesPasado = 0;

    // Calculamos el sueldo y arrastre
    todosLosSueldos.forEach((doc) => {
      const presupuesto = doc.data();
      if (presupuesto.mes === mesActual) sueldoMesActual = presupuesto.monto;
      if (presupuesto.mes === mesPasado) sueldoMesPasado = presupuesto.monto;
    });

    todosLosGastos.forEach((doc) => {
      const gasto = doc.data(); // AQUÍ ESTÁ LA LÍNEA QUE TE FALTABA
      if (gasto.fecha && gasto.fecha.startsWith(mesPasado)) {
        gastosMesPasado += Number(gasto.monto) || 0;
      }
    });

    saldoAnterior = sueldoMesPasado - gastosMesPasado;
    if (sueldoMesPasado === 0) saldoAnterior = 0;

    // --- 3. PROCESAR MES ACTUAL ---
    listaGastos.innerHTML = "";
    let totalGastosMesActual = 0;
    const totalesPorCategoria = {};

    todosLosGastos.forEach((doc) => {
      const gasto = doc.data(); // ¡Y TAMBIÉN AQUÍ!
      const idGasto = doc.id;

      if (gasto.fecha && gasto.fecha.startsWith(mesActual)) {
        const montoLimpio = Number(gasto.monto) || 0;
        totalGastosMesActual += montoLimpio;

        if (totalesPorCategoria[gasto.categoria]) {
          totalesPorCategoria[gasto.categoria] += montoLimpio;
        } else {
          totalesPorCategoria[gasto.categoria] = montoLimpio;
        }

        const nuevoElementoLista = document.createElement("li");
        nuevoElementoLista.innerHTML = `
        <span><strong>${gasto.categoria}</strong> <br> <small>${gasto.fecha}</small></span>
        <div>
        <span style="color: #c0392b; font-weight: bold;">$${montoLimpio.toFixed(2)}</span>
        <button class="btn-borrar" data-id="${idGasto}">X</button>
        </div>`;
        listaGastos.appendChild(nuevoElementoLista);
      }
    });

    // --- 4. MOSTRAR RESULTADOS Y GRÁFICO ---
    inputSueldo.value = sueldoMesActual;
    const saldoFinal = saldoAnterior + sueldoMesActual - totalGastosMesActual;

    elementoSaldo.innerHTML = `
      <small style="display:block; font-size:12px; color: #555;">Saldo Anterior (Arrastre): $${saldoAnterior.toFixed(2)}</small>
      <span>Saldo Actual: $${saldoFinal.toFixed(2)}</span>
    `;

    if (saldoFinal < 0) {
      elementoSaldo.classList.add("saldo-negativo");
    } else {
      elementoSaldo.classList.remove("saldo-negativo");
    }

    divResumenCategorias.innerHTML = "";
    let sumaGarantizada = 0;
    for (const categoria in totalesPorCategoria) {
      divResumenCategorias.innerHTML += `<p><span>${categoria}</span> <strong>$${totalesPorCategoria[categoria].toFixed(2)}</strong></p>`;
      sumaGarantizada += totalesPorCategoria[categoria];
    }

    // Inyectamos el total garantizado
    document.getElementById("total-mes").innerText =
      `${sumaGarantizada.toFixed(2)}`;
    document.getElementById("total-mesgasto").innerText =
      `${sumaGarantizada.toFixed(2)}`;

    // Dibujar Gráfico
    const etiquetasGrafico = Object.keys(totalesPorCategoria);
    const valoresGrafico = Object.values(totalesPorCategoria);
    const contextoLienzo = document
      .getElementById("miGrafico")
      .getContext("2d");

    if (graficoVisual) {
      graficoVisual.destroy();
    }

    graficoVisual = new Chart(contextoLienzo, {
      type: "doughnut",
      data: {
        labels: etiquetasGrafico,
        datasets: [
          {
            data: valoresGrafico,
            backgroundColor: [
              "#27ae60",
              "#2980b9",
              "#e67e22",
              "#e74c3c",
              "#8e44ad",
              "#34495e",
            ],
            borderWidth: 2,
            hoverOffset: 4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    });

    const botonesBorrar = document.querySelectorAll(".btn-borrar");
    botonesBorrar.forEach((boton) => {
      boton.addEventListener("click", async function (evento) {
        const idParaBorrar = evento.target.getAttribute("data-id");
        if (confirm("¿Seguro que quieres borrar este gasto?")) {
          await deleteDoc(doc(db, "gastos", idParaBorrar));
          cargarGastosDesdeFirebase();
        }
      });
    });
  } catch (error) {
    console.error("Error al cargar datos ", error);
  }
}

// Ejecutar al iniciar
// cargarGastosDesdeFirebase();
