// 1. Usamos los enlaces directos (CDN) en lugar del nombre corto
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAX9brFVKMB_e6tdhzZcD6p3G8sXCjPIVs",
  authDomain: "miappgastos-824aa.firebaseapp.com",
  projectId: "miappgastos-824aa",
  storageBucket: "miappgastos-824aa.firebasestorage.app",
  messagingSenderId: "88306124090",
  appId: "1:88306124090:web:66d278ff6e23a2edae3c03",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

//seleccionamos los elementos con los cuales interectuaremos
const formulario = document.getElementById("formulario-gastos");
const inputMonto = document.getElementById("monto");
const inputCategoria = document.getElementById("categoria");
const inputFecha = document.getElementById("fecha");
const listaGastos = document.getElementById("lista-gastos");
const elementoTotal = document.getElementById("total-mes");
const inputMesFiltro = document.getElementById("mes-filtro");
const divResumenCategorias = document.getElementById("resumen-categorias");
let graficoVisual = null; // Variable para guardar nuestro gráfico
const inputSueldo = document.getElementById("sueldo-input");
const btnSueldo = document.getElementById("btn-guardar-sueldo");
const elementoSaldo = document.getElementById("saldo-disponible");

//ponemos el mes actual por defecto en el filtro al cargar
const fechaHoy = new Date();
const mesActualString = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, "0")}`;
inputMesFiltro.value = mesActualString;

//le decimos a la app que recargue los datos si cambiamos de mes
inputMesFiltro.addEventListener("change", cargarGastosDesdeFirebase);

let totalSuma = 0;

btnSueldo.addEventListener("click", async () => {
  const monto = parseFloat(inputSueldo.value);
  const mesSeleccionado = inputMesFiltro.value; // Ej: "2026-04"
  if (!isNaN(monto) && mesSeleccionado) {
    // Guardaremos el sueldo con una clave que incluya el mes
    await addDoc(collection(db, "presupuestos"), {
      mes: mesSeleccionado,
      monto: monto,
      fechaCreacion: new Date(),
    });
    alert("Sueldo de " + mesSeleccionado + " guardado.");
    cargarGastosDesdeFirebase(); // Recargamos para actualizar el saldo
  }
});

formulario.addEventListener("submit", async function (evento) {
  // Esto es vital: evita que la página web se recargue al enviar el formulario
  evento.preventDefault();

  // 3. Capturamos los valores que el usuario escribió
  // Usamos parseFloat para asegurarnos de que el monto se trate como un número (con decimales) y no como texto
  const monto = parseFloat(inputMonto.value);
  const categoria = inputCategoria.value;
  const fecha = inputFecha.value;

  //mostramos que se hayan capturado bien los datos
  //console.log("Gasto registrado:", categoria, monto, fecha);

  try {
    const docRef = await addDoc(collection(db, "gastos"), {
      monto: monto,
      categoria: categoria,
      fecha: fecha,
      //guardamos la hora y fecha exacta de creacion por si luego queremos ordenar
      creadoEn: new Date(),
    });

    console.log("Exito! Gasto guardado con el ID secreto: ", docRef.id);
    formulario.reset();

    cargarGastosDesdeFirebase();
  } catch (error) {
    console.error("Error al guardar en Firebase: ", error);
    alert("Hubo un problema al guardar el gasto. Revisa la consola.");
  }
});

async function cargarGastosDesdeFirebase() {
  try {
    // // 1. Traer el sueldo (buscamos el último ingresado)
    // const configSnapshot = await getDocs(collection(db, "configuracion"));
    // let sueldoActual = 0;
    // configSnapshot.forEach((doc) => {
    //   if (doc.data().tipo === "sueldo") sueldoActual = doc.data().monto;
    // });
    // inputSueldo.value = sueldoActual;
    // //le pedimos a firebase que nos traiga los documentos de la coleccion
    // const querySnapshot = await getDocs(collection(db, "gastos"));

    // //limpiamos la vista por las dudas
    // listaGastos.innerHTML = "";
    // totalSuma = 0;

    // const mesSeleccionado = inputMesFiltro.value;
    // const totalesPorCategoria = {}; //Objeto para guardar la suma de cada categoria
    const mesActual = inputMesFiltro.value; // "2026-04"
        
        // --- 1. CALCULAR SALDO ANTERIOR (MES PASADO) ---
        // Obtenemos el año y mes anterior restando 1
        const fechaAux = new Date(mesActual + "-01");
        fechaAux.setMonth(fechaAux.getMonth() - 1);
        const mesPasado = `${fechaAux.getFullYear()}-${String(fechaAux.getMonth() + 1).padStart(2, '0')}`;

        const todosLosGastos = await getDocs(collection(db, "gastos"));
        const todosLosSueldos = await getDocs(collection(db, "presupuestos"));

        let sueldoMesActual = 0;
        let saldoAnterior = 0;
        let gastosMesPasado = 0;
        let sueldoMesPasado = 0;

        // Buscamos sueldos y gastos históricos para el arrastre
        todosLosSueldos.forEach(doc => {
            const data = doc.data();
            if (data.mes === mesActual) sueldoMesActual = data.monto;
            if (data.mes === mesPasado) sueldoMesPasado = data.monto;
        });

        todosLosGastos.forEach(doc => {
            const data = doc.data();
            if (data.fecha.startsWith(mesPasado)) gastosMesPasado += data.monto;
        });

        // El saldo anterior es lo que sobró el mes pasado
        saldoAnterior = sueldoMesPasado - gastosMesPasado;
        if (sueldoMesPasado === 0) saldoAnterior = 0; // Si no hay datos del mes pasado, empezamos en 0

        // --- 2. PROCESAR MES ACTUAL ---
        listaGastos.innerHTML = '';
        let totalGastosMesActual = 0;
        const totalesPorCategoria = {};


    //recorremos cada gasto que nos devolvio firebase
    todosLosGastos.forEach((doc) => {
      //extraemos la informacion del documento
      const gasto = doc.data();
      const idGasto = doc.id; //el id secreto de firebase para poder borrarlo

      //filtro solo procesamos si la fecha del gasto empieza con el mes seleccionado
      if (gasto.fecha.startsWith(mesSeleccionado)) {
        totalGastosMesActual =+ gasto.monto;

        //2 resumen: sumamos la categoria correspondiente
        if (totalesPorCategoria[gasto.categoria]) {
          totalesPorCategoria[gasto.categoria] += gasto.monto;
        } else {
          totalesPorCategoria[gasto.categoria] = gasto.monto;
        }
        //boton borrar
        const nuevoElementoLista = document.createElement("li");
        nuevoElementoLista.innerHTML = `
        <span><strong>${gasto.categoria}</strong> <br> <small>${gasto.fecha}</small></span>
        <div>
        <span style="color: #c0392b; font-weight: bold;">${gasto.monto.toFixed(2)}</span>
        <button class="btn-borrar" data-id="${idGasto}">X</button>
        </div>`;
        listaGastos.appendChild(nuevoElementoLista);
      }
    });
    elementoTotal.innerText = `${totalSuma.toFixed(2)}`;

    //imprimimos el resumen de categorias en pantalla
    divResumenCategorias.innerHTML = "";
    for (const categoria in totalesPorCategoria) {
      divResumenCategorias.innerHTML += `<p><span>${categoria}</span> <strong>${totalesPorCategoria[categoria].toFixed(2)}</strong></p>`;
    }
    // --- 3. MOSTRAR RESULTADOS FINALES ---
        inputSueldo.value = sueldoMesActual;
        
        // Fórmula final: Saldo Anterior + Sueldo Nuevo - Gastos Actuales
        const saldoFinal = saldoAnterior + sueldoMesActual - totalGastosMesActual;
        
        elementoTotal.innerText = `$${totalGastosMesActual.toFixed(2)}`;
        elementoSaldo.innerHTML = `
            <small style="display:block; font-size:12px;">Saldo Anterior: $${saldoAnterior.toFixed(2)}</small>
            <span>Total: $${saldoFinal.toFixed(2)}</span>
        `;
    // 3. CALCULAR SALDO
    //const saldoFinal = sueldoActual - totalSuma;
    elementoSaldo.innerText = `$${saldoFinal.toFixed(2)}`;

    // Cambiar color si es negativo
    if (saldoFinal < 0) {
      elementoSaldo.classList.add("saldo-negativo");
    } else {
      elementoSaldo.classList.remove("saldo-negativo");
    }
    // --- INICIO CÓDIGO DEL GRÁFICO ---

    // 1. Convertimos nuestro objeto en dos listas separadas para el gráfico
    // Etiquetas será: ["Comida", "Ferretería", "Transporte", etc.]
    const etiquetasGrafico = Object.keys(totalesPorCategoria);
    // Valores será: [1500, 4500, 800, etc.]
    const valoresGrafico = Object.values(totalesPorCategoria);

    // 2. Seleccionamos nuestro lienzo en el HTML
    const contextoLienzo = document
      .getElementById("miGrafico")
      .getContext("2d");

    // 3. Si ya había un gráfico dibujado de un mes anterior, lo destruimos
    if (graficoVisual) {
      graficoVisual.destroy();
    }

    // 4. ¡Dibujamos el nuevo gráfico!
    graficoVisual = new Chart(contextoLienzo, {
      type: "doughnut", // Tipo "dona" (queda muy bien en celulares)
      data: {
        labels: etiquetasGrafico,
        datasets: [
          {
            data: valoresGrafico,
            // Colores para cada categoría
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
        plugins: {
          legend: {
            position: "bottom", // Leyenda abajo
          },
        },
      },
    });
    // --- FIN CÓDIGO DEL GRÁFICO ---

    //le damos vida a los botones de borrar
    const botonesBorrar = document.querySelectorAll(".btn-borrar");
    botonesBorrar.forEach((boton) => {
      boton.addEventListener("click", async function (evento) {
        const idParaBorrar = evento.target.getAttribute("data-id");
        //confirmacion para no borrar por accidente
        if (confirm("Seguro que quieres borrar este gasto?")) {
          await deleteDoc(doc(db, "gastos", idParaBorrar)); //borra de Firebase
          cargarGastosDesdeFirebase(); //recarga la lista automaticamente
        }
      });
    });
  } catch (error) {
    console.error("Error al cargar datos ", error);
  }
}

cargarGastosDesdeFirebase();
