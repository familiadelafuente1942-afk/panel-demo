// ── utilidades compartidas ────────────────────────────────────

export const ahora = () =>
  new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });

export const hoyStr = () => new Date().toLocaleDateString("es-AR");

// Convierte un File a dataURL, redimensionando para no mandar 8MB a la IA.
export function aDataUrl(file, maxLado = 1400) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (Math.max(w, h) > maxLado) {
          const k = maxLado / Math.max(w, h);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        c.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(fr.result);
      img.src = fr.result;
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
}

export const mediaType = (dataUrl) =>
  (String(dataUrl).match(/data:(.*?);/) || [])[1] || "image/jpeg";

export const soloBase64 = (dataUrl) => String(dataUrl).split(",")[1];

// Carga jsPDF desde CDN con reintentos (mismo patrón que la app real).
export async function cargarJsPDF() {
  if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
  const urls = [
    "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js",
    "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
  ];
  for (const src of urls) {
    try {
      await new Promise((res, rej) => {
        const sc = document.createElement("script");
        sc.src = src; sc.onload = res; sc.onerror = rej;
        document.head.appendChild(sc);
      });
      if (window.jspdf && window.jspdf.jsPDF) return window.jspdf.jsPDF;
    } catch { /* pruebo el siguiente CDN */ }
  }
  throw new Error("No se pudo cargar jsPDF");
}

const dimensiones = (dataUrl) =>
  new Promise((res) => {
    const im = new Image();
    im.onload = () => res({ w: im.naturalWidth || 300, h: im.naturalHeight || 200 });
    im.onerror = () => res({ w: 300, h: 200 });
    im.src = dataUrl;
  });

// ── PDF del informe semanal ──────────────────────────────────
// Replica la estética de los informes reales: membrete, hilo de bronce,
// secciones, y las fotos comparadas si existen.
export async function generarPDF({ obra, texto, fotoAntes, fotoHoy, avance, marca = "Constructora" }) {
  const jsPDF = await cargarJsPDF();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 42;
  let y = M;

  const ensure = (n) => { if (y + n > H - M) { doc.addPage(); y = M; } };

  // encabezado
  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(15, 27, 45);
  doc.text(marca.toUpperCase(), W / 2, y, { align: "center" }); y += 15;
  doc.setFontSize(8); doc.setTextColor(176, 137, 79);
  doc.text("INFORME SEMANAL DE OBRA", W / 2, y, { align: "center" }); y += 16;
  doc.setDrawColor(176, 137, 79); doc.setLineWidth(1.4);
  doc.line(M, y, W - M, y); y += 16;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(60, 72, 88);
  doc.text(`Obra: ${obra}`, M, y);
  doc.text(`Emitido: ${hoyStr()}`, W - M, y, { align: "right" }); y += 13;
  if (avance != null) { doc.text(`Avance declarado: ${avance}%`, M, y); y += 16; } else { y += 3; }

  // comparación fotográfica
  if (fotoAntes || fotoHoy) {
    ensure(30);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(27, 58, 91);
    doc.text("Comparación fotográfica", M, y); y += 6;
    doc.setDrawColor(176, 137, 79); doc.setLineWidth(2);
    doc.line(M, y, M + 26, y); y += 14;

    const ancho = (W - 2 * M - 12) / 2;
    let alto = 0;
    const pares = [[fotoAntes, "Anterior"], [fotoHoy, "Actual"]];
    for (let i = 0; i < pares.length; i++) {
      const [src, rot] = pares[i];
      if (!src) continue;
      const d = await dimensiones(src);
      const h = Math.min(150, ancho * d.h / d.w);
      alto = Math.max(alto, h);
      const x = M + i * (ancho + 12);
      ensure(h + 26);
      try { doc.addImage(src, "JPEG", x, y, ancho, h); } catch { /* imagen inválida */ }
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(120, 130, 145);
      doc.text(rot.toUpperCase(), x, y + h + 11);
    }
    y += alto + 24;
  }

  // cuerpo del informe: los títulos en MAYÚSCULA se destacan
  const lineas = String(texto || "").split("\n");
  for (const ln of lineas) {
    const t = ln.trim();
    if (!t) { y += 6; continue; }
    const esTitulo = t === t.toUpperCase() && t.length < 60 && /[A-ZÁÉÍÓÚÑ]/.test(t);
    if (esTitulo) {
      ensure(30);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(27, 58, 91);
      doc.text(t, M, y); y += 6;
      doc.setDrawColor(176, 137, 79); doc.setLineWidth(2);
      doc.line(M, y, M + 26, y); y += 14;
    } else {
      doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(26, 36, 51);
      for (const l of doc.splitTextToSize(t, W - 2 * M)) {
        ensure(14); doc.text(l, M, y); y += 14;
      }
      y += 4;
    }
  }

  // pie
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(150, 160, 175);
  doc.text(`Generado por ${marca} · Informe semanal de obra`, W / 2, H - 26, { align: "center" });

  const blob = doc.output("blob");
  const nombre = `Informe semanal ${obra}.pdf`;
  const file = new File([blob], nombre, { type: "application/pdf" });

  // En iPad abre la hoja de compartir (mandarlo por WhatsApp/mail en la reunión)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: nombre }); return; }
    catch (e) { if (e && e.name === "AbortError") return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
