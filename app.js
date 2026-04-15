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

//ponemos el mes actual por defecto en el filtro al cargar
const fechaHoy = new Date();
const mesActualString = `${fechaHoy.getFullYear()}-${String(fechaHoy.getMonth() + 1).padStart(2, "0")}`;
inputMesFiltro.value = mesActualString;

//le decimos a la app que recargue los datos si cambiamos de mes
inputMesFiltro.addEventListener("change", cargarGastosDesdeFirebase);

let totalSuma = 0;

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
    // //creamos visualmente el renglon para la lista del historial
    // const nuevoElementoLista = document.createElement("li");

    // nuevoElementoLista.innerHTML = `
    //     <span><strong>${categoria}</strong> <br> <small>${fecha}</small></span>
    //     <span style="color: #c0392b; font-weight: bold;">${monto.toFixed(2)}</span>`;

    // //agregamos ese renglon a la lista
    // listaGastos.appendChild(nuevoElementoLista);

    // //actualizamos el numero del total del mes
    // totalSuma = totalSuma + monto;
    // elementoTotal.innerText = `${totalSuma.toFixed(2)}`;

    // formulario.reset();
  } catch (error) {
    console.error("Error al guardar en Firebase: ", error);
    alert("Hubo un problema al guardar el gasto. Revisa la consola.");
  }
});

async function cargarGastosDesdeFirebase() {
  try {
    //le pedimos a firebase que nos traiga los documentos de la coleccion
    const querySnapshot = await getDocs(collection(db, "gastos"));

    //limpiamos la vista por las dudas
    listaGastos.innerHTML = "";
    totalSuma = 0;

    const mesSeleccionado = inputMesFiltro.value;
    const totalesPorCategoria = {}; //Objeto para guardar la suma de cada categoria

    //recorremos cada gasto que nos devolvio firebase
    querySnapshot.forEach((doc) => {
      //extraemos la informacion del documento
      const gasto = doc.data();
      const idGasto = doc.id; //el id secreto de firebase para poder borrarlo

      //filtro solo procesamos si la fecha del gasto empieza con el mes seleccionado
      if (gasto.fecha.startsWith(mesSeleccionado)) {
        totalSuma = totalSuma + gasto.monto;

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
