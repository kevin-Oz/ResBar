new Vue({
    el: "#appRESBAR",
    data: {
        // Aqui inician las propiedades que vamos a necesitar
        //para almacenar nuestros objetos de trabajo
        parametros: [],
        parametro: {
            id: "0",
            nombre: "",
            valor: "",
        },
        urlApi: `${ApiRestUrl}/parametros`,

        ordenSelected: "",
        nuevoResumen: {
            fecha: null,
            total: null,
            productos: [],
        },
        uri: ApiRestUrl + "/ordenes/",
        uriVentas: ApiRestUrl + "/resumenDeVentas",
        resumenDeVenta: [],

        bitacora: {
            fecha: "",
            accion: "",
            nombreCompleto: "",
            loggin: "",
            descripcion: "",
        },
        logName: logName,
        propina: null,
        domicilio: null,
    },
    mounted: function() {
        this.getParam();
        this.obtenerSelected();
    },
    methods: {
        /**
         * obtenine el valor de un parametro enviado por url
         * @param String name nombre del parametro
         * @return String  el parametro
         */
        getParameterByName(name) {
            name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
            var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
                results = regex.exec(location.search);
            return results === null ?
                "" :
                decodeURIComponent(results[1].replace(/\+/g, " "));
        },

        getParam() {
            axios
                .get(this.urlApi)
                .then((response) => {
                    this.parametros = response.data;
                    this.propina = parseFloat(this.parametros[8].valor) / 100;
                })
                .catch((ex) => {
                    console.log(ex);
                });
        },
        async getParametros() {
            await axios
                .get(ApiRestUrl + "/parametros")
                .then((res) => {
                    this.parametros = res.data;
                })
                .catch((er) => console.error(er));
        },

        //Obtener orden seleccionada
        obtenerSelected() {
            axios
                .get(this.uri + this.getParameterByName("id"))
                .then((response) => {
                    this.ordenSelected = response.data;
                    if (this.ordenSelected.domicilio == true) {
                        this.domicilio = this.parametros[10].valor;
                    } else {
                        this.domicilio = 0;
                    }
                    this.propina = this.ordenSelected.total * this.propina;
                    this.propina = this.propina.toFixed(2);
                    this.productosOrden = this.ordenSelected.detalleOrden;
                    let fecha = this.convertDate(this.ordenSelected.fecha);
                    document.getElementById("fecha").textContent = "Fecha: " + fecha;
                    document.getElementById("total").textContent =
                        "Total: $" + this.ordenSelected.total.toFixed(2);
                    this.checkTotal();
                    this.checkEstado();
                })
                .catch((e) => {
                    console.log(e);
                });
        },

        //Cambiamos el estado de la orden a cobrada
        updateEstado() {
            let uriId = this.uri + this.getParameterByName("id");
            this.ordenSelected.total = parseFloat(
                this.ordenSelected.total.toFixed(2)
            );
            this.ordenSelected.estado = "C";
            this.ordenSelected.propina = parseFloat(this.propina);
            this.ordenSelected.costoEnvio = parseFloat(this.domicilio);
            axios
                .put(uriId, this.ordenSelected)
                .then((response) => {
                    this.registrarBitacora();
                    console.log(response);
                })
                .catch((e) => {
                    console.log(e);
                });
        },

        redireccionarAOrdenes() {
            window.location = "./ordenes.html";
        },

        //Metodo para cambiar la fecha a formato YYYY-MM-DD
        convertDate() {
            let newDate = new Date(this.ordenSelected.fecha);
            let anio = newDate.getFullYear();
            let mes;
            if (newDate.getMonth() + 1 < 10) {
                mes = "0" + (newDate.getMonth() + 1);
            } else {
                mes = newDate.getMonth() + 1;
            }
            let dia;
            if (newDate.getDate() < 10) {
                dia = "0" + newDate.getDate();
            } else {
                dia = newDate.getDate();
            }
            let formattedDate = anio + "-" + mes + "-" + dia;
            return formattedDate;
        },

        //Metodo para verificar que el total sea igual a la sumatoria de los subtotales del detalle de la Orden
        checkTotal() {
            let total1 = this.ordenSelected.total;
            let total2 = 0;
            for (let i = 0; i < this.ordenSelected.detalleOrden.length; i++) {
                total2 += this.ordenSelected.detalleOrden[i].subtotal;
            }
            if (total1 != total2) {
                this.ordenSelected.total = total2;
            }
        },

        //Metodo para que no se pueda acceder a una orden invalida por url directa
        checkEstado() {
            if (this.ordenSelected.estado == "C") {
                window.location =
                    "./ordenes.html?alert=Invalido:%20Esta%20Orden%20ya%20fue%20cobrada.";
            } else if (this.ordenSelected.estado != "A") {
                this.redireccionarAOrdenes();
            }
        },

        //Obtener el resumen de Ventas
        getResumenVentas() {
            let efectivo = document.getElementById("lblEfectivo").value;
            let cambio = efectivo - this.ordenSelected.total - this.propina;
            let fechaOrden = this.convertDate();
            let filter = {
                where: {
                    fecha: fechaOrden,
                },
            };
            axios
                .get(this.uriVentas + "?filter=" + JSON.stringify(filter))
                .then((response) => {
                    this.resumenDeVenta = response.data;
                    if (this.resumenDeVenta.length == 0) {
                        console.log("vacio");
                        this.createResumenDeVentas();

                    } else {
                        console.log("AQUI LO LLAMARE updateResumenDeVentas");
                        this.updateResumenDeVentas();

                    }
                    console.log("estoy aqui");
                })
                .catch((e) => {
                    console.log(e);
                });
        },

        //Si aun no hay un resumen de ventas creamos uno nuevo.
        createResumenDeVentas() {
            let efectivo = document.getElementById("lblEfectivo").value;

            let cambio =
                efectivo - this.ordenSelected.total - this.propina - this.domicilio;

            let fechaResumen = this.convertDate();
            let productosOrden = this.ordenSelected.detalleOrden;
            let totalOrden = parseFloat(this.ordenSelected.total.toFixed(2));
            let obj = [];
            for (let i = 0; i < productosOrden.length; i++) {
                let array = {
                    nombre: productosOrden[i].nombre,
                    cantidad: productosOrden[i].cantidad,
                };
                obj.unshift(array);
            }
            this.nuevoResumen.fecha = fechaResumen;
            this.nuevoResumen.total = totalOrden;
            this.nuevoResumen.productos = obj;
            this.nuevoResumen.propina = parseFloat(this.propina);
            if (this.domicilio > 0) {
                this.nuevoResumen.costoEnvio = parseFloat(this.domicilio);
            }
            console.log(this.nuevoResumen.propina);
            var cadena =
                "./ordenes.html?alert=Orden%20cobrada:%20" +
                this.ordenSelected.id.substr(-4) +
                ",%20con%20un%20total%20de:%20$" +
                (totalOrden + this.propina + this.domicilio) +
                ",%20efectivo%20de:%20$" +
                efectivo +
                "%20y%20cambio%20de:%20$" +
                cambio.toFixed(2);
            axios
                .post(this.uriVentas, JSON.stringify(this.nuevoResumen), {
                    headers: {
                        "content-type": "application/json",
                    },
                })
                .then((response) => {
                    window.location = cadena;
                })
                .catch((ex) => {
                    console.log(ex);
                });

        },

        //Si ya hay un resumen solo lo actualizamos
        updateResumenDeVentas() {
            let efectivo = document.getElementById("lblEfectivo").value;
            let cambio =
                efectivo - this.ordenSelected.total - this.propina - this.domicilio;

            console.log("updateResumenDeVentas");
            let obj = [];
            for (let i = 0; i < this.ordenSelected.detalleOrden.length; i++) {
                let array = {
                    nombre: this.ordenSelected.detalleOrden[i].nombre,
                    cantidad: this.ordenSelected.detalleOrden[i].cantidad,
                };
                obj.unshift(array);
            }
            let objResumen = [];

            for (let i = 0; i < obj.length; i++) {
                let flag = 0;
                for (let j = 0; j < this.resumenDeVenta[0].productos.length; j++) {
                    if (obj[i].nombre == this.resumenDeVenta[0].productos[j].nombre) {
                        flag = 1;
                        let cantidad2 = this.resumenDeVenta[0].productos[j].cantidad;
                        cantidad2 += obj[i].cantidad;
                        this.resumenDeVenta[0].productos[j].cantidad = cantidad2;
                    } else if (
                        j == this.resumenDeVenta[0].productos.length - 1 &&
                        flag == 0
                    ) {

                        console.log(obj[i].nombre);
                        objResumen.unshift(obj[i]);
                    }
                }
            }
            for (let i = 0; i < objResumen.length; i++) {
                this.resumenDeVenta[0].productos.push(objResumen[i]);
            }
            console.log(this.resumenDeVenta[0].productos);
            let fechaAux = this.convertDate(this.resumenDeVenta[0].fecha);
            let totalAux = parseFloat(
                (this.resumenDeVenta[0].total + this.ordenSelected.total).toFixed(2)
            );
            let prop = this.resumenDeVenta[0].propina + parseFloat(this.propina);
            let dom = this.resumenDeVenta[0].costoEnvio + parseFloat(this.domicilio);
            let datos = {
                fecha: fechaAux,
                total: totalAux,
                propina: prop,
                costoEnvio: dom,
                productos: this.resumenDeVenta[0].productos,
            };
            let uriId = this.uriVentas + "/" + this.resumenDeVenta[0].id;
            console.log(JSON.stringify(datos));
            let totalAlert =
                this.ordenSelected.total +
                parseFloat(this.propina) +
                parseFloat(this.domicilio);
            console.log(totalAlert);
            var cad2 =
                "./ordenes.html?alert=Orden%20cobrada:%20" +
                this.ordenSelected.id.substr(-4) +
                ",%20con%20un%20total%20de:%20$" +
                totalAlert +
                ",%20efectivo%20de:%20$" +
                efectivo +
                "%20y%20cambio%20de:%20$" +
                cambio.toFixed(2);
            axios
                .put(uriId, JSON.stringify(datos), {
                    headers: {
                        "content-type": "application/json",
                    },
                })
                .then((response) => {
                    window.location = cad2;
                })
                .catch((e) => {
                    console.log(e);
                });
        },

        //Aqui esta la funcionalidad al dar click en cobrar
        cobrar: function() {
            this.checkEstado();
            let efectivo = document.getElementById("lblEfectivo").value;
            let propina = document.getElementById("propina").value;
            if (propina != "") {
                totalEfectivo =
                    this.ordenSelected.total +
                    parseFloat(propina) +
                    parseFloat(this.domicilio);
            } else {
                totalEfectivo = this.ordenSelected.total;
            }
            if (efectivo < totalEfectivo) {
                document.getElementById("lblEfectivo").classList.add("is-invalid");
                document.getElementById("propina").classList.add("is-invalid");
                document.getElementById("alerta").textContent =
                    "Ingrese suficiente efectivo";
            } else {
                document.getElementById("lblEfectivo").classList.remove("is-invalid");
                document.getElementById("lblEfectivo").classList.add("is-valid");
                document.getElementById("alerta").textContent = "";
                this.updateEstado();
                this.getResumenVentas();
                console.log(this.resumenDeVenta);
                printJS("ticket", "html");
            }
        },

        valorPropina() {
            var prop;
            element = document.getElementById("propina"); //Obtiene el valor del input
            if (element != null) {
                prop = element.value;
                let propina = parseFloat(prop);
                let valor = propina;
                try {
                    return parseFloat(valor);
                } catch (error) {
                    console.error(error);
                }
            } else {
                let valor = this.parametros[8].valor;
                let total = this.ordenSelected.total;
                try {
                    valor = valor.split("%");
                    valor = valor[0] / 100;
                    let valorP = total * valor;
                    return parseFloat(valorP);
                } catch (error) {
                    console.error(error);
                }
            }
        },

        //  Obtiene el valor del costo de envio de los parametros
        costoDeEnvio() {
            let valor;
            try {
                valor = this.parametros[10].valor;
                return parseFloat(valor);
            } catch (error) {
                console.error(error);
                return valor;
            }
        },

        registrarBitacora() {
            this.bitacora.fecha = new Date().toISOString();
            this.bitacora.accion = "Cobrar orden";
            this.bitacora.nombreCompleto = logName;

            const tipoUsuario = localStorage
                .getItem(VueSession.key)
                .toString()
                .split('"'); //ver si el usuario es adm o mesero
            var logTipoUsuario = tipoUsuario[1];
            this.bitacora.loggin = logTipoUsuario;

            this.bitacora.descripcion =
                "Se cobro una orden de ID=" +
                this.getParameterByName("id").substring(20, 24) +
                " con un total de $ " +
                this.ordenSelected.total;

            axios
                .post(ApiRestUrl + "/bitacoras", JSON.stringify(this.bitacora), {
                    headers: {
                        "content-type": "application/json",
                    },
                })
                .then((response) => {
                    //response.data;
                })
                .catch((error) => {});
        },
    },

    created() {
        if (localStorage.vue_session_key) {} else {
            window.location = "./login.html";
        }
    },
});

//recuerda que recibes un parametro: ID el cual corresponde con el id de la orden con la que vas a trabajar
