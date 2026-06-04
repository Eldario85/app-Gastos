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
  updateDoc, // <-- NUEVO: updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Elementos del DOM
const seccionLogin = document.getElementById("pantalla-login");
const seccionApp = document.getElementById("app-principal");
const btnIngresar = document.getElementById("btn-ingresar-google");

const formulario = document.getElementById("formulario-gastos");
const inputMonto = document.getElementById("monto");
const inputCategoria = document.getElementById("categoria");
const inputDescripcion = document.getElementById("descripcion"); // <-- NUEVO
const inputFecha = document.getElementById("fecha");
const btnSubmitGasto = document.getElementById("btn-submit-gasto");
const btnCancelarEdicion = document.getElementById("btn-cancelar-edicion");

const listaGastos = document.getElementById("lista-gastos");
const inputMesFiltro = document.getElementById("mes-filtro");
const divResumenCategorias = document.getElementById("resumen-categorias");
const inputSueldo = document.getElementById("sueldo-input");
const btnSueldo = document.getElementById("btn-guardar-sueldo");
const elementoSaldo = document.getElementById("saldo-disponible");
const btnModoOscuro = document.getElementById("btn-modo-oscuro"); // <-- NUEVO
const btnExportar = document.getElementById("btn-exportar"); // <-- NUEVO

// Variables de Estado
let usuarioActual = null;
let graficoVisual = null;
let idGastoEnEdicion = null; // <-- NUEVO: Para saber si estamos editando

// Función para transformar números a formato local (puntos en miles, comas en decimales)
function formatearNumeroLocal(numero) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero);
}

// Inicialización de Fecha
const fechaHoy = new Date();
inputMesFiltro.value = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, "0")}`;
inputMesFiltro.addEventListener("change", cargarGastosDesdeFirebase);

// --- MODO OSCURO ---
btnModoOscuro.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  if (document.body.classList.contains("dark-mode")) {
    btnModoOscuro.innerText = "☀️";
  } else {
    btnModoOscuro.innerText = "🌙";
  }
});

// --- AUTENTICACIÓN ---
btnIngresar.addEventListener("click", function () {
  signInWithPopup(auth, provider).catch((error) =>
    alert("Hubo un error: " + error.message),
  );
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    usuarioActual = user;
    seccionLogin.style.display = "none";
    seccionApp.style.display = "block";
    cargarGastosDesdeFirebase();
  } else {
    usuarioActual = null;
    seccionLogin.style.display = "block";
    seccionApp.style.display = "none";
  }
});

// --- GUARDAR SUELDO ---
btnSueldo.addEventListener("click", async () => {
  const monto = parseFloat(inputSueldo.value);
  const mesSeleccionado = inputMesFiltro.value;
  if (!isNaN(monto) && mesSeleccionado && usuarioActual) {
    await addDoc(collection(db, "presupuestos"), {
      mes: mesSeleccionado,
      monto: monto,
      autorId: usuarioActual.uid,
      fechaCreacion: new Date(),
    });
    alert("Sueldo guardado.");
    cargarGastosDesdeFirebase();
  }
});

// --- GUARDAR O ACTUALIZAR GASTO ---
formulario.addEventListener("submit", async function (evento) {
  evento.preventDefault();
  if (!usuarioActual) return;

  const datosGasto = {
    monto: parseFloat(inputMonto.value),
    categoria: inputCategoria.value,
    descripcion: inputDescripcion.value || "", // Guarda vacío si no escriben nada
    fecha: inputFecha.value,
    autorId: usuarioActual.uid,
    ultimaModificacion: new Date(),
  };

  try {
    if (idGastoEnEdicion) {
      // MODO EDICIÓN
      await updateDoc(doc(db, "gastos", idGastoEnEdicion), datosGasto);
      idGastoEnEdicion = null;
      btnSubmitGasto.innerText = "Guardar Gasto";
      btnCancelarEdicion.style.display = "none";
    } else {
      // MODO CREACIÓN NORMAL
      datosGasto.creadoEn = new Date();
      await addDoc(collection(db, "gastos"), datosGasto);
    }

    formulario.reset();
    cargarGastosDesdeFirebase();
  } catch (error) {
    console.error("Error al guardar: ", error);
    alert("Hubo un problema al procesar el gasto.");
  }
});

// --- CANCELAR EDICIÓN ---
btnCancelarEdicion.addEventListener("click", () => {
  idGastoEnEdicion = null;
  formulario.reset();
  btnSubmitGasto.innerText = "Guardar Gasto";
  btnCancelarEdicion.style.display = "none";
});

// --- LECTURA PRINCIPAL ---
async function cargarGastosDesdeFirebase() {
  if (!usuarioActual) return;

  try {
    const mesActual = inputMesFiltro.value; // Ej: "2026-05"

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

    // 1. FILTRAMOS SUELDOS DUPLICADOS (La magia antibugs)
    let sueldosPorMes = {};
    todosLosSueldos.forEach((doc) => {
      const p = doc.data();
      if (p.mes) {
        // Si hay varios sueldos para el mismo mes, esto guarda solo el último ingresado
        sueldosPorMes[p.mes] = p.monto;
      }
    });

    // 2. SUMAMOS TODO EL INGRESO HISTÓRICO HASTA HOY
    let sumaSueldosHistoricos = 0;
    for (const mes in sueldosPorMes) {
      if (mes < mesActual) {
        sumaSueldosHistoricos += sueldosPorMes[mes];
      }
    }
    // El saldo anterior real es: Todo lo que entró - Todo lo que salió (antes de hoy)
    const saldoAnterior = sumaSueldosHistoricos - sumaGastosHistoricos;

    // Obtenemos el sueldo del mes actual de nuestro diccionario limpio
    let sueldoMesActual = sueldosPorMes[mesActual] || 0;

    // --- 2. PROCESAR MES ACTUAL ---
    listaGastos.innerHTML = "";
    let totalGastosMesActual = 0;
    const totalesPorCategoria = {};
    let gastosDelMes = [];

    // Filtramos y preparamos los gastos solo del mes seleccionado para la lista
    todosLosGastos.forEach((doc) => {
      const gasto = doc.data();
      const mesDelGasto = gasto.fecha ? gasto.fecha.substring(0, 7) : "";

      if (mesDelGasto === mesActual) {
        const montoLimpio = Number(gasto.monto) || 0;
        totalGastosMesActual += montoLimpio;

        if (totalesPorCategoria[gasto.categoria]) {
          totalesPorCategoria[gasto.categoria] += montoLimpio;
        } else {
          totalesPorCategoria[gasto.categoria] = montoLimpio;
        }

        gastosDelMes.push({
          id: doc.id,
          montoLimpio: montoLimpio,
          ...gasto,
        });
      }
    });

    // 2. ORDENAMOS LA CAJA (De más reciente a más antiguo)
    gastosDelMes.sort((a, b) => {
      if (a.fecha > b.fecha) return -1;
      if (a.fecha < b.fecha) return 1;

      if (a.creadoEn && b.creadoEn) {
        return b.creadoEn.toMillis() - a.creadoEn.toMillis();
      }
      return 0;
    });

    // 3. AHORA SÍ, DIBUJAMOS LA LISTA ORDENADA
    gastosDelMes.forEach((gasto) => {
      const descripcionHTML = gasto.descripcion
        ? `<em>${gasto.descripcion}</em><br>`
        : "";
      const li = document.createElement("li");
      li.innerHTML = `
        <span><strong>${gasto.categoria}</strong> <br> ${descripcionHTML} <small>${gasto.fecha}</small></span>
        <div>
            <span style="color: #c0392b; font-weight: bold;">$${formatearNumeroLocal(gasto.montoLimpio)}</span>
            <button class="btn-editar" data-id="${gasto.id}" data-monto="${gasto.montoLimpio}" data-cat="${gasto.categoria}" data-desc="${gasto.descripcion || ""}" data-fecha="${gasto.fecha}">✏️</button>
            <button class="btn-borrar" data-id="${gasto.id}">X</button>
        </div>`;
      listaGastos.appendChild(li);
    });

    inputSueldo.value = sueldoMesActual;
    const saldoFinal = saldoAnterior + sueldoMesActual - totalGastosMesActual;

    elementoSaldo.innerHTML = `
  <small style="display:block; font-size:12px; color: #555;">Saldo Anterior (Arrastre): $${formatearNumeroLocal(saldoAnterior)}</small>
  <span>Saldo Actual: $${formatearNumeroLocal(saldoFinal)}</span>
`;

    if (saldoFinal < 0) elementoSaldo.classList.add("saldo-negativo");
    else elementoSaldo.classList.remove("saldo-negativo");

    divResumenCategorias.innerHTML = "";
    let sumaGarantizada = 0;
    elementoSaldo.innerHTML = `
  <small style="display:block; font-size:12px; color: #555;">Saldo Anterior (Arrastre): $${formatearNumeroLocal(saldoAnterior)}</small>
  <span>Saldo Actual: $${formatearNumeroLocal(saldoFinal)}</span>
`;

    // GRÁFICO
    const ctx = document.getElementById("miGrafico").getContext("2d");
    if (graficoVisual) graficoVisual.destroy();
    graficoVisual = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: Object.keys(totalesPorCategoria),
        datasets: [
          {
            data: Object.values(totalesPorCategoria),
            backgroundColor: [
              "#27ae60",
              "#2980b9",
              "#e67e22",
              "#e74c3c",
              "#8e44ad",
              "#34495e",
              "#f1c40f",
              "#1abc9c",
            ],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
      },
    });

    // ACTIVAR BOTONES DE BORRAR Y EDITAR
    document.querySelectorAll(".btn-borrar").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        if (confirm("¿Borrar este gasto?")) {
          await deleteDoc(doc(db, "gastos", e.target.getAttribute("data-id")));
          cargarGastosDesdeFirebase();
        }
      });
    });

    document.querySelectorAll(".btn-editar").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.target;
        inputMonto.value = target.getAttribute("data-monto");
        inputCategoria.value = target.getAttribute("data-cat");
        inputDescripcion.value = target.getAttribute("data-desc");
        inputFecha.value = target.getAttribute("data-fecha");

        idGastoEnEdicion = target.getAttribute("data-id");
        btnSubmitGasto.innerText = "Actualizar Gasto";
        btnCancelarEdicion.style.display = "inline-block";
        window.scrollTo(0, 0);
      });
    });
  } catch (error) {
    console.error("Error al cargar datos ", error);
  }
}

// --- EXPORTAR A EXCEL (CSV) ---
btnExportar.addEventListener("click", async () => {
  if (!usuarioActual) return;

  const mesActual = inputMesFiltro.value;
  const consultaGastos = query(
    collection(db, "gastos"),
    where("autorId", "==", usuarioActual.uid),
  );
  const snapshot = await getDocs(consultaGastos);

  // Encabezados del Excel
  let csvContent = "Fecha,Categoria,Descripcion,Monto\n";

  snapshot.forEach((doc) => {
    const g = doc.data();
    if (g.fecha && g.fecha.startsWith(mesActual)) {
      // Limpiamos comas en textos para que no rompan el Excel
      const desc = g.descripcion ? g.descripcion.replace(/,/g, " ") : "";
      const cat = g.categoria ? g.categoria.replace(/,/g, " ") : "";
      csvContent += `${g.fecha},${cat},${desc},${g.monto}\n`;
    }
  });

  // Crear el archivo descargable
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `MisGastos_${mesActual}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});
