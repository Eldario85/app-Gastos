import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// --- EVENTO: GUARDAR SUELDO ---
btnSueldo.addEventListener("click", async () => {
  const monto = parseFloat(inputSueldo.value);
  const mesSeleccionado = inputMesFiltro.value; 
  if (!isNaN(monto) && mesSeleccionado) {
    await addDoc(collection(db, "presupuestos"), {
      mes: mesSeleccionado,
      monto: monto,
      fechaCreacion: new Date(),
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
    const mesActual = inputMesFiltro.value; 
    
    // 1. CALCULAR MES PASADO PARA EL ARRASTRE
    const fechaAux = new Date(mesActual + "-01");
    fechaAux.setMonth(fechaAux.getMonth() - 1);
    const mesPasado = `${fechaAux.getFullYear()}-${String(fechaAux.getMonth() + 1).padStart(2, '0')}`;

    const todosLosGastos = await getDocs(collection(db, "gastos"));
    const todosLosSueldos = await getDocs(collection(db, "presupuestos"));

    let sueldoMesActual = 0;
    let saldoAnterior = 0;
    let gastosMesPasado = 0;
    let sueldoMesPasado = 0;

    // Buscar sueldos en la base de datos
    todosLosSueldos.forEach(doc => {
      const data = doc.data();
      if (data.mes === mesActual) sueldoMesActual = data.monto;
      if (data.mes === mesPasado) sueldoMesPasado = data.monto;
    });

    // Calcular gastos del mes pasado
    todosLosGastos.forEach(doc => {
      const data = doc.data();
      if (data.fecha.startsWith(mesPasado)) gastosMesPasado += data.monto;
    });

    // Determinar lo que sobró el mes pasado
    saldoAnterior = sueldoMesPasado - gastosMesPasado;
    if (sueldoMesPasado === 0) saldoAnterior = 0;

    // 2. PROCESAR MES ACTUAL
    listaGastos.innerHTML = '';
    let totalGastosMesActual = 0;
    const totalesPorCategoria = {};

todosLosGastos.forEach((doc) => {
      const gasto = doc.data();
      const idGasto = doc.id;

      if (gasto.fecha && gasto.fecha.startsWith(mesActual)) {
        
        // --- LA DEFENSA ---
        // Nos aseguramos de que el monto sea un número. Si viene vacío o corrupto, lo convertimos en 0.
        const montoLimpio = Number(gasto.monto) || 0;

        totalGastosMesActual += montoLimpio;

        if (totalesPorCategoria[gasto.categoria]) {
          totalesPorCategoria[gasto.categoria] += montoLimpio;
        } else {
          totalesPorCategoria[gasto.categoria] = montoLimpio;
        }
        
        // Para crear el elemento en la lista usamos montoLimpio en vez de gasto.monto
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

    // 3. MOSTRAR RESULTADOS FINALES
    inputSueldo.value = sueldoMesActual;
    
    // Fórmula final: Saldo Anterior + Sueldo Nuevo - Gastos Actuales
    const saldoFinal = saldoAnterior + sueldoMesActual - totalGastosMesActual;
    
    // Actualizar textos en pantalla
    elementoTotal.innerText = `$${totalGastosMesActual.toFixed(2)}`;
    
    // CORRECCIÓN: Solo usamos innerHTML para mostrar ambas líneas, eliminamos el innerText viejo
    elementoSaldo.innerHTML = `
      <small style="display:block; font-size:12px; color: #555;">Saldo Anterior (Arrastre): $${saldoAnterior.toFixed(2)}</small>
      <span>Saldo Actual: $${saldoFinal.toFixed(2)}</span>
    `;

    // Cambiar color a rojo si hay deuda
    if (saldoFinal < 0) {
      elementoSaldo.classList.add("saldo-negativo");
    } else {
      elementoSaldo.classList.remove("saldo-negativo");
    }

    // 4. RESUMEN DE CATEGORÍAS EN TEXTO
    divResumenCategorias.innerHTML = "";
    for (const categoria in totalesPorCategoria) {
      divResumenCategorias.innerHTML += `<p><span>${categoria}</span> <strong>$${totalesPorCategoria[categoria].toFixed(2)}</strong></p>`;
    }

    // 5. GRÁFICO (Chart.js)
    const etiquetasGrafico = Object.keys(totalesPorCategoria);
    const valoresGrafico = Object.values(totalesPorCategoria);
    const contextoLienzo = document.getElementById("miGrafico").getContext("2d");

    if (graficoVisual) {
      graficoVisual.destroy();
    }

    graficoVisual = new Chart(contextoLienzo, {
      type: "doughnut",
      data: {
        labels: etiquetasGrafico,
        datasets: [{
            data: valoresGrafico,
            backgroundColor: ["#27ae60", "#2980b9", "#e67e22", "#e74c3c", "#8e44ad", "#34495e"],
            borderWidth: 2,
            hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });

    // 6. EVENTOS DE LOS BOTONES DE BORRAR
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
cargarGastosDesdeFirebase();
