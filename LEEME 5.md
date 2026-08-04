# Panel de demostración — 4 apps conectadas

Herramienta de venta. Muestra las 4 apps en una sola pantalla y la sincronización
en vivo entre ellas. Pensado para iPad horizontal.

No usa backend ni base de datos: todo vive en memoria y se reinicia al recargar.
Eso es a propósito — funciona sin internet y nunca ensucia datos reales.

---

## IMPORTANTE: la carpeta `api`

Todos los archivos van en la raíz del repositorio, EXCEPTO `chat.js`, que tiene
que quedar dentro de una carpeta llamada `api`. Vercel solo reconoce las
funciones de servidor si están ahí.

Si al subir a GitHub se te aplanó todo (quedó `chat.js` en la raíz), hacé esto:
1. Borrá el `chat.js` que quedó suelto en la raíz
2. En GitHub, tocá "Add file" → "Create new file"
3. En el nombre escribí exactamente: `api/chat.js` — al poner la barra, GitHub
   crea la carpeta solo
4. Pegá adentro el contenido del archivo `api/chat.js` de este paquete
5. "Commit changes"

---

## Subirlo a Vercel (una sola vez, ~3 minutos)

**Opción A — desde la web (la más simple)**
1. Entrá a vercel.com → "Add New" → "Project"
2. Arrastrá esta carpeta completa (sin `node_modules`) o subila a un repo de GitHub
3. Vercel detecta Vite solo. No cambies ninguna configuración.
4. Deploy → te da una URL tipo `panel-demo-obra.vercel.app`

**Opción B — desde la terminal**
```bash
npm i -g vercel     # si no la tenés
cd panel-demo
vercel              # seguí el wizard, elegí "new project"
```

**Probarlo local antes de subir**
```bash
npm install
npm run dev         # abre en localhost:5173
```

---

## Activar la IA real (OBLIGATORIO antes de mostrarlo)

El botón "Analizar avance con IA" manda las DOS fotos (la anterior y la de hoy)
a la IA, que las compara de verdad, describe qué cambió, estima el porcentaje de
avance y redacta el informe.

Para que funcione:
1. En Vercel: Settings → Environment Variables
2. Agregá `ANTHROPIC_API_KEY` con tu API key de Anthropic
3. Redeploy

**Cómo saber si está lista antes de una reunión:** arriba a la izquierda, al lado
del título, hay un indicador. Si dice **"IA conectada" en verde**, está todo bien.
Si dice **"IA sin configurar" en naranja**, el botón de análisis de fotos ni
siquiera aparece — así nunca mostrás algo que no anda.

El botón "Informe semanal" (sin fotos) sí tiene texto de respaldo y funciona
aunque se caiga el WiFi.

La API key vive solo en el servidor (`api/chat.js`). Nunca viaja al navegador.

---

## Dejarlo como app en el iPad

Abrí la URL en Safari → botón Compartir → "Agregar a pantalla de inicio".
Queda con ícono propio y se abre a pantalla completa, sin barra del navegador.
Así en la reunión parece una app, no una página web.

---

## Guion de demostración (3 minutos)

1. **Abrí el panel** y dejá que vean las 4 pantallas juntas.
   Decí: "esto que ven son cuatro apps distintas, una por cada rol."

2. **Sacá una foto ahí mismo** con "Subir foto de avance".
   Es el momento de mayor impacto: la foto aparece sola en el panel del
   estudio y en el del propietario. Señalá el pulso dorado.

3. **Tocá "Pedir definición"** — se prende la alarma roja en el estudio.
   Decí: "así es como el estudio se entera. Nadie reenvía nada."

4. **Tocá "Responder"** en el panel del estudio.
   El estado cambia a RESUELTO en las tres apps a la vez.
   Ese es el argumento de trazabilidad: queda registrado quién respondió y cuándo.

5. **Tocá "Emitir certificado"** — mirá cómo sube sola la barra verde de avance
   del propietario. Decí: "el dueño se entera sin llamar a nadie."

6. **El cierre fuerte: comparación de fotos con IA.**
   - Tocá "Foto anterior" y elegí una foto vieja de la obra desde la galería.
   - Tocá "Foto de hoy" — abre la cámara. Sacá una foto ahí mismo, o usá otra
     de la galería que muestre la obra más avanzada.
   - Tocá **"Analizar avance con IA"**.

   La IA compara las dos imágenes de verdad: describe qué cambió entre una y
   otra, estima el porcentaje de avance, y cruza eso con las definiciones que
   quedaron sin responder. **La barra verde del propietario se mueve sola al
   porcentaje que estimó la IA.**

   Leé en voz alta la sección RIESGOS. Decí: "esto lo escribió mirando las fotos,
   hace diez segundos."

7. **Tocá "Descargar PDF"** dentro del informe.
   Sale el PDF con membrete, las dos fotos comparadas lado a lado y el informe
   completo. En iPad se abre la hoja de compartir: mandáselo al cliente por
   WhatsApp ahí mismo, delante de él. Ese es el momento que cierra la venta.

8. **Cerrá señalando el panel del propietario**: "fijate que él nunca ve pedidos
   ni costos internos. Cada uno ve exactamente lo que le corresponde."

**Antes del próximo cliente**: tocá "Reiniciar demo".

---

## Si querés cambiar algo

- **Nombre de la obra**: en `src/PanelDemo.jsx`, la constante `OBRA` (arriba de todo).
- **Textos de los pedidos**: funciones `pedirMateriales` y `pedirDefinicion`.
- **Colores**: constantes `BRASS`, `NAVY` y el objeto `T` al inicio del archivo.
