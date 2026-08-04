import React, { useState, useRef, useEffect } from "react";
import { ahora, aDataUrl, mediaType, soloBase64, generarPDF } from "./lib.js";

// ════════════════════════════════════════════════════════════
// PANEL DE DEMOSTRACIÓN — 4 apps conectadas, sincronización en vivo
// Pensado para iPad horizontal. Todo en memoria: se reinicia al recargar.
// ════════════════════════════════════════════════════════════

const BRASS = "#B0894F";
const NAVY = "#101C2C";
const T = {
  bg: "#F5F6F8", card: "#FFFFFF", border: "#E6E9EE",
  text: "#131C2B", sub: "#4A5565", muted: "#8B95A5",
  ok: "#2F7A4F", amber: "#B5651D", red: "#E23D2E", teal: "#1F5560",
};

const OBRA = "Obra Los Álamos 100";

export default function PanelDemo() {
  // ── estado compartido: la única fuente de verdad de las 4 apps ──
  const [fotos, setFotos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [certificados, setCertificados] = useState([]);
  const [flash, setFlash] = useState({});       // panel -> true (pulso visual)
  const [ultimo, setUltimo] = useState(null);   // texto del último evento
  const [informe, setInforme] = useState(null); // informe semanal generado por IA
  const [generando, setGenerando] = useState(false);
  const [verInforme, setVerInforme] = useState(false);
  const [fotoAntes, setFotoAntes] = useState(null);   // foto de referencia
  const [fotoHoy, setFotoHoy] = useState(null);       // foto actual
  const [avanceIA, setAvanceIA] = useState(null);     // % que estimó la IA
  const [iaOk, setIaOk] = useState(null);             // null = chequeando
  const [pdfBusy, setPdfBusy] = useState(false);
  const fileRef = useRef(null);
  const antesRef = useRef(null);
  const hoyRef = useRef(null);

  // Al abrir, chequeo si la IA está disponible (antes de una reunión).
  useEffect(() => {
    fetch("/api/chat")
      .then((r) => r.json())
      .then((d) => setIaOk(Boolean(d.ia)))
      .catch(() => setIaOk(false));
  }, []);

  // pulso visual en los paneles que reciben el dato
  function pulso(paneles) {
    const on = {};
    paneles.forEach((p) => (on[p] = true));
    setFlash(on);
    setTimeout(() => setFlash({}), 1800);
  }

  // ── acciones ──
  function subirFoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setFotos((p) => [{ id: Date.now(), url, hora: ahora(), nombre: f.name }, ...p]);
    setUltimo("Foto de avance cargada en Constructora → visible en Estudio y Propietario");
    pulso(["estudio", "propietario"]);
    e.target.value = "";
  }

  function pedirMateriales() {
    setPedidos((p) => [
      { id: Date.now(), tipo: "material", txt: "50 bolsas de cemento + 20 hierros del 8", hora: ahora(), estado: "enviado" },
      ...p,
    ]);
    setUltimo("Pedido de materiales cargado en Contratista → visible en Constructora y Estudio");
    pulso(["constructora", "estudio"]);
  }

  function pedirDefinicion() {
    setPedidos((p) => [
      { id: Date.now(), tipo: "definicion", txt: "Definición: nivel de piso terminado en baño PB", hora: ahora(), estado: "pendiente" },
      ...p,
    ]);
    setUltimo("Pedido de definición cargado en Contratista → el Estudio lo ve al instante");
    pulso(["constructora", "estudio"]);
  }

  function emitirCertificado() {
    const n = certificados.length + 1;
    setCertificados((p) => [
      { id: Date.now(), n, hora: ahora(), avance: Math.min(80, 45 + n * 5) },
      ...p,
    ]);
    setUltimo("Certificado semanal emitido en Constructora → Estudio para aprobar, Propietario para ver");
    pulso(["estudio", "propietario"]);
  }

  // ── informe semanal analizado por IA ──
  async function generarInforme() {
    if (generando) return;
    setGenerando(true);
    setVerInforme(true);
    setInforme(null);
    setUltimo("Generando informe semanal con IA sobre los datos cargados…");

    // Se le manda a la IA SOLO lo que realmente pasó en la demo
    const materiales = pedidos.filter((p) => p.tipo === "material");
    const definiciones = pedidos.filter((p) => p.tipo === "definicion");
    const sinResolver = definiciones.filter((p) => p.estado !== "resuelto");

    const datos = `
OBRA: ${OBRA}
FOTOS DE AVANCE CARGADAS ESTA SEMANA: ${fotos.length}
PEDIDOS DE MATERIALES: ${materiales.length}${materiales.map((m) => `\n  - ${m.txt} (${m.hora})`).join("")}
PEDIDOS DE DEFINICIÓN AL ESTUDIO: ${definiciones.length}${definiciones.map((d) => `\n  - ${d.txt} — estado: ${d.estado} (${d.hora})`).join("")}
DEFINICIONES SIN RESOLVER: ${sinResolver.length}
CERTIFICADOS EMITIDOS: ${certificados.length}
AVANCE DECLARADO: ${certificados[0]?.avance ?? 45}%
`.trim();

    const system =
      "Sos el asistente técnico de una empresa constructora argentina. " +
      "Escribís informes semanales de obra en español rioplatense, con tono profesional y concreto, " +
      "como los que se presentan a un estudio de arquitectura o a un comitente. " +
      "Nunca inventes datos que no estén en la información provista. " +
      "Si faltan definiciones por resolver, remarcalo como riesgo de retraso.";

    const prompt =
      `Generá el informe semanal de obra con estos datos reales del sistema:\n\n${datos}\n\n` +
      "Formato exacto (sin markdown, sin asteriscos):\n" +
      "DESARROLLO DE LA SEMANA: 2 o 3 oraciones sobre lo ejecutado.\n" +
      "PEDIDOS Y DEFINICIONES: qué se pidió y qué quedó pendiente.\n" +
      "RIESGOS: si hay definiciones sin resolver, indicá el impacto posible en el plazo. Si no hay, decilo.\n" +
      "PRÓXIMOS PASOS: 2 acciones concretas.\n" +
      "Máximo 180 palabras en total.";

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, system }),
      });
      if (!r.ok) throw new Error("sin respuesta");
      const d = await r.json();
      if (!d.texto) throw new Error("vacío");
      setInforme({ texto: d.texto, hora: ahora(), ia: true });
      setUltimo("Informe generado por IA → publicado en Estudio y Propietario");
    } catch {
      // Respaldo: si no hay API key o falla la red, la demo NO se rompe.
      setInforme({ texto: informeRespaldo(fotos.length, materiales.length, sinResolver.length, certificados[0]?.avance ?? 45), hora: ahora(), ia: false });
      setUltimo("Informe generado (modo sin conexión) → publicado en Estudio y Propietario");
    }

    setGenerando(false);
    pulso(["estudio", "propietario"]);
  }


  // ── comparación de fotos analizada por IA (visión real) ──
  async function cargarComparacion(e, cual) {
    const f = e.target.files?.[0];
    if (!f) return;
    const dataUrl = await aDataUrl(f);
    if (cual === "antes") setFotoAntes({ url: dataUrl, hora: ahora() });
    else {
      setFotoHoy({ url: dataUrl, hora: ahora() });
      // la foto de hoy también entra al flujo normal de la obra
      setFotos((p) => [{ id: Date.now(), url: dataUrl, hora: ahora(), nombre: f.name }, ...p]);
      pulso(["estudio", "propietario"]);
      setUltimo("Foto de hoy cargada → visible en Estudio y Propietario");
    }
    e.target.value = "";
  }

  async function analizarAvance() {
    if (!fotoAntes || !fotoHoy) {
      setUltimo("Cargá la foto anterior y la de hoy para comparar.");
      return;
    }
    setGenerando(true);
    setVerInforme(true);
    setInforme(null);
    setUltimo("La IA está comparando las dos fotos de obra…");

    const definiciones = pedidos.filter((p) => p.tipo === "definicion");
    const sinResolver = definiciones.filter((p) => p.estado !== "resuelto");
    const materiales = pedidos.filter((p) => p.tipo === "material");

    const content = [
      { type: "image", source: { type: "base64", media_type: mediaType(fotoAntes.url), data: soloBase64(fotoAntes.url) } },
      { type: "image", source: { type: "base64", media_type: mediaType(fotoHoy.url), data: soloBase64(fotoHoy.url) } },
      { type: "text", text:
        `La PRIMERA imagen es el estado ANTERIOR de la obra "${OBRA}". La SEGUNDA es el estado ACTUAL.\n\n` +
        `Datos del sistema de gestión para esta semana:\n` +
        `- Pedidos de materiales cursados: ${materiales.length}\n` +
        `- Definiciones pedidas al estudio: ${definiciones.length}\n` +
        `- Definiciones SIN resolver: ${sinResolver.length}${sinResolver.map((d) => "\n    · " + d.txt).join("")}\n\n` +
        `Compará las dos fotos y redactá el informe semanal con este formato exacto ` +
        `(sin markdown, sin asteriscos, títulos en MAYÚSCULA sueltos en su propia línea):\n\n` +
        `AVANCE DETECTADO\n` +
        `Qué cambió concretamente entre la primera y la segunda foto. Sé específico sobre los trabajos visibles.\n\n` +
        `ESTADO ACTUAL\n` +
        `En qué etapa está la obra según lo que se ve.\n\n` +
        `PEDIDOS Y DEFINICIONES\n` +
        `Qué se pidió esta semana y qué quedó pendiente.\n\n` +
        `RIESGOS\n` +
        `Si hay definiciones sin resolver, indicá el impacto en el plazo. Mencioná también cualquier alerta de seguridad que veas en las fotos.\n\n` +
        `PRÓXIMOS PASOS\n` +
        `Dos acciones concretas.\n\n` +
        `Al final, en una línea sola y sin nada más, escribí: AVANCE_ESTIMADO: NN` +
        ` (siendo NN tu estimación del porcentaje de avance global de la obra, solo el número).`
      },
    ];

    const system =
      "Sos inspector técnico de obra de una empresa constructora argentina. " +
      "Analizás fotografías de obra y redactás informes semanales en español rioplatense, " +
      "con criterio profesional y concreto. Nunca inventes trabajos que no se vean en las fotos. " +
      "Si hay definiciones sin resolver, remarcalas como riesgo de plazo.";

    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, system }),
      });
      if (!r.ok) throw new Error("sin respuesta");
      const d = await r.json();
      if (!d.texto) throw new Error("vacio");

      // extraigo el % estimado y lo saco del cuerpo del informe
      const m = d.texto.match(/AVANCE_ESTIMADO:\s*(\d{1,3})/i);
      const pct = m ? Math.min(100, parseInt(m[1], 10)) : null;
      const limpio = d.texto.replace(/AVANCE_ESTIMADO:.*$/im, "").trim();

      if (pct != null) setAvanceIA(pct);
      setInforme({ texto: limpio, hora: ahora(), ia: true, conFotos: true });
      setUltimo(
        pct != null
          ? `La IA comparó las fotos y estimó ${pct}% de avance → publicado en Estudio y Propietario`
          : "La IA comparó las fotos → informe publicado en Estudio y Propietario"
      );
      pulso(["estudio", "propietario"]);
    } catch {
      setInforme(null);
      setVerInforme(false);
      setUltimo("No se pudo conectar con la IA. Revisá la API key en Vercel.");
    }
    setGenerando(false);
  }

  async function descargarPDF() {
    if (!informe || pdfBusy) return;
    setPdfBusy(true);
    try {
      await generarPDF({
        obra: OBRA,
        texto: informe.texto,
        fotoAntes: fotoAntes?.url,
        fotoHoy: fotoHoy?.url,
        avance: avanceIA ?? certificados[0]?.avance ?? null,
      });
      setUltimo("PDF del informe generado y listo para compartir");
    } catch {
      setUltimo("No se pudo generar el PDF. Revisá la conexión.");
    }
    setPdfBusy(false);
  }

  function responderEstudio(id) {
    setPedidos((p) => p.map((x) => (x.id === id ? { ...x, estado: "resuelto" } : x)));
    setUltimo("El Estudio respondió → el Contratista ve la respuesta al instante");
    pulso(["contratista", "constructora"]);
  }

  function reiniciar() {
    fotos.forEach((f) => URL.revokeObjectURL(f.url));
    setFotos([]); setPedidos([]); setCertificados([]);
    setUltimo(null); setFlash({}); setInforme(null); setVerInforme(false);
    setFotoAntes(null); setFotoHoy(null); setAvanceIA(null);
  }

  useEffect(() => () => fotos.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const pendientes = pedidos.filter((p) => p.estado !== "resuelto").length;
  const avance = avanceIA ?? certificados[0]?.avance ?? 45;

  return (
    <div style={{ minHeight: "100vh", background: "#0E1520", fontFamily: "Inter, -apple-system, sans-serif", padding: 14 }}>
      <style>{`
        @keyframes pulseIn { 0%{box-shadow:0 0 0 0 rgba(176,137,79,.75)} 100%{box-shadow:0 0 0 16px rgba(176,137,79,0)} }
        .flash { animation: pulseIn 1.4s ease-out 1; }
        @keyframes slideIn { from{opacity:0; transform:translateY(-6px)} to{opacity:1; transform:none} }
        .new { animation: slideIn .35s ease-out; }
        .scroll::-webkit-scrollbar{ width:5px } .scroll::-webkit-scrollbar-thumb{ background:#D3D8DF; border-radius:5px }
      `}</style>

      {/* ── barra de control del vendedor ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginRight: 6 }}>
          <span style={{ width: 20, height: 2, background: BRASS }} />
          <span style={{ color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: "-0.01em" }}>
            Demo en vivo · {OBRA}
          </span>
          <span title={iaOk ? "IA conectada" : iaOk === false ? "Sin API key: el análisis de fotos no está disponible" : "Verificando…"}
            style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 10, fontWeight: 700,
              color: iaOk ? "#7DBE4B" : iaOk === false ? "#E08A3E" : "#6C7787",
              border: `1px solid ${iaOk ? "rgba(125,190,75,.4)" : "rgba(255,255,255,.15)"}`,
              borderRadius: 20, padding: "3px 9px",
            }}>
            <i style={{
              width: 6, height: 6, borderRadius: "50%", fontStyle: "normal",
              background: iaOk ? "#7DBE4B" : iaOk === false ? "#E08A3E" : "#6C7787",
            }} />
            {iaOk ? "IA conectada" : iaOk === false ? "IA sin configurar" : "Verificando"}
          </span>
        </div>

        <input ref={fileRef} type="file" accept="image/*" onChange={subirFoto} style={{ display: "none" }} />
        <input ref={antesRef} type="file" accept="image/*" onChange={(e) => cargarComparacion(e, "antes")} style={{ display: "none" }} />
        <input ref={hoyRef} type="file" accept="image/*" capture="environment" onChange={(e) => cargarComparacion(e, "hoy")} style={{ display: "none" }} />

        <Boton onClick={() => antesRef.current?.click()} ok={!!fotoAntes}>
          {fotoAntes ? "✓ Foto anterior" : "🖼 Foto anterior"}
        </Boton>
        <Boton onClick={() => hoyRef.current?.click()} ok={!!fotoHoy}>
          {fotoHoy ? "✓ Foto de hoy" : "📷 Foto de hoy"}
        </Boton>

        {iaOk !== false && (
          <Boton onClick={analizarAvance} principal disabled={!fotoAntes || !fotoHoy || generando}>
            {generando ? "⏳ Comparando…" : "✨ Analizar avance con IA"}
          </Boton>
        )}

        <Boton onClick={pedirMateriales}>📦 Materiales</Boton>
        <Boton onClick={pedirDefinicion}>✎ Definición</Boton>
        <Boton onClick={emitirCertificado}>📋 Certificado</Boton>
        <Boton onClick={generarInforme}>
          {generando ? "⏳…" : "📝 Informe semanal"}
        </Boton>

        <button onClick={reiniciar} style={{
          marginLeft: "auto", background: "transparent", border: "1px solid rgba(255,255,255,.25)",
          color: "#B9C2CF", borderRadius: 8, padding: "9px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>Reiniciar demo</button>
      </div>

      {/* ── aviso del último evento ── */}
      <div style={{
        minHeight: 34, display: "flex", alignItems: "center", gap: 8, marginBottom: 12,
        background: ultimo ? "rgba(176,137,79,.16)" : "rgba(255,255,255,.05)",
        border: `1px solid ${ultimo ? "rgba(176,137,79,.4)" : "rgba(255,255,255,.08)"}`,
        borderRadius: 9, padding: "8px 13px", transition: "all .3s",
      }}>
        <span style={{ fontSize: 13 }}>{ultimo ? "⚡" : "○"}</span>
        <span style={{ color: ultimo ? "#F0DCBC" : "#6C7787", fontSize: 12.5, fontWeight: 600 }}>
          {ultimo || "Tocá una acción arriba: vas a ver el dato aparecer en las otras apps al instante."}
        </span>
      </div>

      {/* ── grilla 2×2 ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 12, height: "calc(100vh - 118px)" }}>

        {/* ─── 1. CONSTRUCTORA ─── */}
        <Panel titulo="Constructora" sub="Centro de comando" flash={flash.constructora}>
          <NavApp items={[
            { t: "IA", on: true }, { t: "Obras", b: 5 }, { t: "Avance" },
            { t: "Bitácora" }, { t: "Pedidos", b: pendientes || null }, { t: "Auditoría" },
          ]} />
          <Cuerpo>
            {(fotoAntes || fotoHoy) && (
              <>
                <Lbl>Comparación de avance</Lbl>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 11 }}>
                  {[[fotoAntes, "Anterior"], [fotoHoy, "Hoy"]].map(([f, rot]) => (
                    <div key={rot} style={{
                      border: `1px solid ${f ? BRASS : T.border}`, borderRadius: 8,
                      overflow: "hidden", background: "#fff",
                    }}>
                      {f ? (
                        <img src={f.url} alt={rot} style={{ width: "100%", height: 66, objectFit: "cover", display: "block" }} />
                      ) : (
                        <div style={{ height: 66, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, color: T.muted }}>
                          sin cargar
                        </div>
                      )}
                      <div style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase",
                        color: T.muted, textAlign: "center", padding: "4px 0",
                      }}>{rot}</div>
                    </div>
                  ))}
                </div>
                {avanceIA != null && (
                  <div className="new" style={{
                    background: "#FBF6EE", border: `1px solid ${BRASS}`, borderRadius: 8,
                    padding: "8px 11px", marginBottom: 11, fontSize: 10.5, fontWeight: 700, color: T.text,
                  }}>
                    ✨ La IA estimó <b style={{ color: BRASS }}>{avanceIA}% de avance</b> comparando las fotos
                  </div>
                )}
              </>
            )}

            <Lbl>Fotos de avance · {OBRA}</Lbl>
            {fotos.length === 0 ? (
              <Vacio>Sin fotos todavía. Tocá "Subir foto de avance".</Vacio>
            ) : (
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }} className="scroll">
                {fotos.map((f, i) => (
                  <img key={f.id} src={f.url} alt="" className={i === 0 ? "new" : ""}
                    style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 7, border: `1px solid ${T.border}`, flexShrink: 0 }} />
                ))}
              </div>
            )}

            <Lbl style={{ marginTop: 12 }}>Pedidos recibidos del contratista</Lbl>
            {pedidos.length === 0 ? (
              <Vacio>Sin pedidos.</Vacio>
            ) : pedidos.slice(0, 3).map((p, i) => (
              <Fila key={p.id} nuevo={i === 0}>
                <span style={{ flex: 1 }}>{p.txt}</span>
                <Chip tono={p.estado === "resuelto" ? "ok" : p.tipo === "material" ? "ok" : "wait"}>
                  {p.estado === "resuelto" ? "RESUELTO" : p.estado.toUpperCase()}
                </Chip>
              </Fila>
            ))}

            <Lbl style={{ marginTop: 12 }}>Certificados emitidos</Lbl>
            {certificados.length === 0 ? <Vacio>Ninguno.</Vacio> : certificados.slice(0, 2).map((c, i) => (
              <Fila key={c.id} nuevo={i === 0}>
                <span style={{ flex: 1 }}>Certificado semanal Nº {c.n} · avance {c.avance}%</span>
                <span style={{ color: T.muted, fontSize: 9.5 }}>{c.hora}</span>
              </Fila>
            ))}
          </Cuerpo>
        </Panel>

        {/* ─── 2. ESTUDIO DE ARQUITECTURA ─── */}
        <Panel titulo="Estudio de arquitectura" sub="Ve todo al instante" flash={flash.estudio}>
          <NavApp items={[
            { t: "IA", on: true }, { t: "Obras", b: 8 }, { t: "Informes", b: certificados.length || null },
            { t: "Pedidos recibidos", b: pendientes || null }, { t: "Planos" },
          ]} />
          {pendientes > 0 && (
            <div className="new" style={{
              display: "flex", alignItems: "center", gap: 8, background: "#FDECEA",
              borderBottom: "1px solid #F6CFC9", padding: "8px 12px",
            }}>
              <i style={{
                width: 19, height: 19, borderRadius: "50%", background: T.red, color: "#fff",
                fontSize: 10, fontWeight: 700, fontStyle: "normal", display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>{pendientes}</i>
              <b style={{ fontSize: 11, color: "#9B2C1E" }}>
                {pendientes} pedido{pendientes > 1 ? "s" : ""} pendiente{pendientes > 1 ? "s" : ""} de la obra
              </b>
            </div>
          )}
          <Cuerpo>
            <Lbl>Pedidos del contratista</Lbl>
            {pedidos.length === 0 ? <Vacio>Nada pendiente.</Vacio> : pedidos.slice(0, 3).map((p, i) => (
              <Fila key={p.id} nuevo={i === 0}>
                <span style={{ flex: 1 }}>{p.txt}</span>
                {p.estado === "resuelto"
                  ? <Chip tono="ok">RESUELTO</Chip>
                  : <button onClick={() => responderEstudio(p.id)} style={{
                      background: T.teal, color: "#fff", border: "none", borderRadius: 6,
                      padding: "4px 9px", fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                    }}>Responder</button>}
              </Fila>
            ))}

            {(informe || generando) && (
              <>
                <Lbl>Informe semanal · analizado por IA</Lbl>
                <div className="new" onClick={() => setVerInforme(true)} style={{
                  background: "#FBF6EE", border: `1px solid ${BRASS}`, borderRadius: 8,
                  padding: "9px 11px", marginBottom: 11, cursor: "pointer",
                }}>
                  {generando ? (
                    <div style={{ fontSize: 10.5, color: T.sub, fontWeight: 600 }}>
                      ⏳ La IA está analizando los datos de la obra…
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 10, color: T.text, lineHeight: 1.45, fontWeight: 600, maxHeight: 46, overflow: "hidden" }}>
                        {informe.texto.split("\n").filter(Boolean)[1]}
                      </div>
                      <div style={{ fontSize: 9, color: BRASS, fontWeight: 700, marginTop: 5 }}>
                        Ver informe completo →
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            <Lbl style={{ marginTop: 12 }}>Certificados a aprobar</Lbl>
            {certificados.length === 0 ? <Vacio>Ninguno.</Vacio> : certificados.slice(0, 2).map((c, i) => (
              <Fila key={c.id} nuevo={i === 0}>
                <span style={{ flex: 1 }}>Certificado Nº {c.n} · {OBRA}</span>
                <Chip tono="wait">A APROBAR</Chip>
              </Fila>
            ))}

            <Lbl style={{ marginTop: 12 }}>Fotos que subió la obra</Lbl>
            {fotos.length === 0 ? <Vacio>Sin fotos.</Vacio> : (
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }} className="scroll">
                {fotos.map((f, i) => (
                  <img key={f.id} src={f.url} alt="" className={i === 0 ? "new" : ""}
                    style={{ width: 74, height: 56, objectFit: "cover", borderRadius: 7, border: `1px solid ${T.border}`, flexShrink: 0 }} />
                ))}
              </div>
            )}
          </Cuerpo>
        </Panel>

        {/* ─── 3. CONTRATISTA ─── */}
        <Panel titulo="Contratista" sub="Pide desde la obra" flash={flash.contratista} navy>
          <div style={{ background: NAVY, padding: "10px 13px" }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".13em", textTransform: "uppercase", color: "#D9B57C" }}>
              Pedidos · materiales, planos y definiciones
            </div>
          </div>
          <Cuerpo>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 12 }}>
              {[["▣", "Materiales", "#141C2B"], ["✎", "Definiciones", BRASS], ["▤", "Planos", "#3B6CA8"]].map(([ic, t, c]) => (
                <div key={t} style={{
                  textAlign: "center", fontSize: 9.5, fontWeight: 700, color: T.text,
                  border: `1px solid ${T.border}`, borderTop: `2px solid ${c}`, borderRadius: 9, padding: "10px 4px",
                }}>{ic}<br />{t}</div>
              ))}
            </div>

            <Lbl>Mis pedidos · {pedidos.length} en total</Lbl>
            {pedidos.length === 0 ? <Vacio>Todavía no pediste nada.</Vacio> : pedidos.map((p, i) => (
              <Fila key={p.id} nuevo={i === 0}>
                <span style={{ flex: 1 }}>{p.txt}</span>
                <Chip tono={p.estado === "resuelto" ? "ok" : p.tipo === "material" ? "ok" : "wait"}>
                  {p.estado === "resuelto" ? "RESPONDIDO" : p.estado.toUpperCase()}
                </Chip>
              </Fila>
            ))}
            <div style={{ fontSize: 9, color: T.muted, marginTop: 9, lineHeight: 1.4 }}>
              Cada pedido queda cargado a la vez acá, en la constructora y en el estudio.
            </div>
          </Cuerpo>
        </Panel>

        {/* ─── 4. PROPIETARIO ─── */}
        <Panel titulo="Propietario" sub="Solo lectura" flash={flash.propietario}>
          <div style={{ background: "linear-gradient(160deg,#2C3440,#171C24)", padding: "14px 16px 13px", textAlign: "center" }}>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.7)" }}>
              Tu proyecto
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginTop: 2 }}>{OBRA}</div>
            <div style={{ height: 5, background: "rgba(255,255,255,.25)", borderRadius: 6, margin: "9px auto 5px", maxWidth: 190, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${avance}%`, background: "#7DBE4B", transition: "width .8s cubic-bezier(.16,1,.3,1)" }} />
            </div>
            <div style={{ fontSize: 10, color: "#D6DCE4" }}>Avance {avance}%</div>
          </div>
          <Cuerpo>
            <Lbl>Fotos de avance</Lbl>
            {fotos.length === 0 ? <Vacio>Tu constructora todavía no subió fotos.</Vacio> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {fotos.slice(0, 6).map((f, i) => (
                  <img key={f.id} src={f.url} alt="" className={i === 0 ? "new" : ""}
                    style={{ width: "100%", height: 58, objectFit: "cover", borderRadius: 7, border: `1px solid ${T.border}` }} />
                ))}
              </div>
            )}

            <Lbl style={{ marginTop: 12 }}>Informes</Lbl>
            {informe && (
              <div className="new" onClick={() => setVerInforme(true)} style={{
                display: "flex", alignItems: "center", gap: 7, background: "#FBF6EE",
                border: `1px solid ${BRASS}`, borderRadius: 8, padding: "8px 10px",
                marginBottom: 5, fontSize: 10.5, fontWeight: 700, color: T.text, cursor: "pointer",
              }}>
                <span style={{ flex: 1 }}>✨ Informe semanal · {OBRA}</span>
                <span style={{ color: BRASS, fontSize: 9 }}>Ver →</span>
              </div>
            )}
            {certificados.length === 0 && !informe ? <Vacio>Sin informes publicados.</Vacio> : certificados.slice(0, 3).map((c, i) => (
              <Fila key={c.id} nuevo={i === 0}>
                <span style={{ flex: 1 }}>Informe semanal Nº {c.n}</span>
                <span style={{ color: T.muted, fontSize: 9.5 }}>{c.hora}</span>
              </Fila>
            ))}

            <div style={{
              marginTop: 12, fontSize: 8.5, fontWeight: 700, letterSpacing: ".08em",
              textTransform: "uppercase", color: T.muted, textAlign: "center",
            }}>Modo solo lectura · no ve pedidos ni costos internos</div>
          </Cuerpo>
        </Panel>
      </div>

      {/* ── informe completo ── */}
      {verInforme && (
        <div onClick={() => setVerInforme(false)} style={{
          position: "fixed", inset: 0, background: "rgba(8,12,18,.72)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 26,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 15, maxWidth: 620, width: "100%",
            maxHeight: "82vh", display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "16px 20px 13px", borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 18, height: 2, background: BRASS }} />
                <span style={{
                  fontSize: 9.5, fontWeight: 700, letterSpacing: ".14em",
                  textTransform: "uppercase", color: BRASS,
                }}>
                  {generando ? "Generando" : informe?.ia ? "Analizado por IA" : "Informe generado"}
                </span>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>Informe semanal de obra</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 2 }}>
                {OBRA}{informe ? ` · generado ${informe.hora}` : ""}
              </div>
            </div>

            <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
              {generando ? (
                <div style={{ fontSize: 13, color: T.sub, lineHeight: 1.7 }}>
                  ⏳ La IA está leyendo las fotos cargadas, los pedidos de materiales y las
                  definiciones pendientes para armar el informe…
                </div>
              ) : (
                <pre style={{
                  margin: 0, fontFamily: "inherit", fontSize: 13, lineHeight: 1.65,
                  color: T.text, whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>{informe?.texto}</pre>
              )}
            </div>

            <div style={{
              padding: "12px 20px", borderTop: `1px solid ${T.border}`,
              display: "flex", alignItems: "center", gap: 10, background: "#FAFBFC",
            }}>
              <span style={{ fontSize: 10.5, color: T.muted, flex: 1, lineHeight: 1.4 }}>
                Se publica automáticamente en el panel del estudio y en el del propietario.
              </span>
              {informe && (
                <button onClick={descargarPDF} disabled={pdfBusy} style={{
                  background: BRASS, color: "#fff", border: "none", borderRadius: 8,
                  padding: "9px 16px", fontSize: 12, fontWeight: 700,
                  cursor: pdfBusy ? "wait" : "pointer",
                }}>{pdfBusy ? "Generando…" : "📄 Descargar PDF"}</button>
              )}
              <button onClick={() => setVerInforme(false)} style={{
                background: NAVY, color: "#fff", border: "none", borderRadius: 8,
                padding: "9px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Informe de respaldo: se usa si no hay API key o si falla la red.
// Existe para que la demo nunca quede colgada delante de un cliente.
function informeRespaldo(nFotos, nMat, nSinResolver, avance) {
  return [
    "DESARROLLO DE LA SEMANA",
    `La obra registró ${nFotos} ${nFotos === 1 ? "carga fotográfica" : "cargas fotográficas"} de avance y se declara un avance global del ${avance}%. Se sostuvo el ritmo de ejecución previsto en las tareas de albañilería y terminaciones.`,
    "",
    "PEDIDOS Y DEFINICIONES",
    `${nMat === 1 ? "Se cursó 1 pedido" : `Se cursaron ${nMat} pedidos`} de materiales. ${nSinResolver > 0 ? (nSinResolver === 1 ? "Queda 1 definición pendiente de respuesta por parte del estudio." : `Quedan ${nSinResolver} definiciones pendientes de respuesta por parte del estudio.`) : "No quedan definiciones pendientes de respuesta."}`,
    "",
    "RIESGOS",
    nSinResolver > 0
      ? "Las definiciones sin resolver comprometen el avance del sector afectado. De extenderse más allá del plazo de respuesta acordado, corresponde computar el perjuicio por dotación detenida."
      : "No se registran riesgos de plazo atribuibles a definiciones pendientes.",
    "",
    "PRÓXIMOS PASOS",
    "1. Completar las tareas de terminación en los sectores habilitados.",
    nSinResolver > 0
      ? "2. Obtener respuesta del estudio sobre las definiciones pendientes."
      : "2. Avanzar con la programación de la semana siguiente según cronograma.",
  ].join("\n");
}

// ── piezas reutilizables ──────────────────────────────────────

function Boton({ children, onClick, principal, ok, disabled }) {
  const fondo = disabled ? "rgba(255,255,255,.05)"
    : ok ? "rgba(125,190,75,.18)"
    : principal ? BRASS : "rgba(255,255,255,.08)";
  const borde = disabled ? "rgba(255,255,255,.1)"
    : ok ? "rgba(125,190,75,.5)"
    : principal ? BRASS : "rgba(255,255,255,.18)";
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{
      background: fondo, color: disabled ? "#5A6472" : "#fff",
      border: `1px solid ${borde}`,
      borderRadius: 8, padding: "9px 14px", fontSize: 12, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", whiteSpace: "nowrap",
      transition: "all .2s",
    }}>{children}</button>
  );
}

function Panel({ titulo, sub, children, flash }) {
  return (
    <div className={flash ? "flash" : ""} style={{
      background: T.card, borderRadius: 13, overflow: "hidden",
      display: "flex", flexDirection: "column",
      border: `1px solid ${flash ? BRASS : "rgba(255,255,255,.1)"}`,
      transition: "border-color .3s",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 13px", background: "#F0F2F5", borderBottom: `1px solid ${T.border}`,
      }}>
        <span style={{ width: 14, height: 2, background: BRASS, flexShrink: 0 }} />
        <b style={{ fontSize: 11.5, color: NAVY }}>{titulo}</b>
        <span style={{ fontSize: 9.5, color: T.muted, marginLeft: "auto" }}>{sub}</span>
      </div>
      {children}
    </div>
  );
}

function NavApp({ items }) {
  return (
    <div style={{
      display: "flex", gap: 12, padding: "8px 12px", borderBottom: `2px solid ${BRASS}`,
      background: "#fff", overflowX: "auto", whiteSpace: "nowrap",
    }} className="scroll">
      {items.map((it) => (
        <span key={it.t} style={{
          position: "relative", fontSize: 9.5, fontWeight: 700, flexShrink: 0,
          color: it.on ? NAVY : it.b ? "#C0392B" : "#5A6472",
          borderBottom: it.on ? `2px solid ${BRASS}` : "none", paddingBottom: 2,
        }}>
          {it.t}
          {it.b ? (
            <i style={{
              position: "absolute", top: -6, right: -12, background: T.red, color: "#fff",
              fontSize: 7, fontWeight: 700, borderRadius: 20, padding: "1px 4px", fontStyle: "normal",
            }}>{it.b}</i>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function Cuerpo({ children }) {
  return (
    <div className="scroll" style={{ flex: 1, overflowY: "auto", padding: "11px 13px 14px", background: "#FAFBFC" }}>
      {children}
    </div>
  );
}

function Lbl({ children, style }) {
  return (
    <div style={{
      fontSize: 8.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
      color: T.muted, marginBottom: 7, ...style,
    }}>{children}</div>
  );
}

function Vacio({ children }) {
  return <div style={{ fontSize: 10.5, color: T.muted, padding: "8px 0", lineHeight: 1.4 }}>{children}</div>;
}

function Fila({ children, nuevo }) {
  return (
    <div className={nuevo ? "new" : ""} style={{
      display: "flex", alignItems: "center", gap: 7, background: "#fff",
      border: `1px solid ${nuevo ? BRASS : T.border}`, borderRadius: 8,
      padding: "8px 10px", marginBottom: 5, fontSize: 10.5, color: T.text, fontWeight: 600,
    }}>{children}</div>
  );
}

function Chip({ children, tono }) {
  const c = tono === "ok"
    ? { bg: "#EAF3EC", fg: T.ok }
    : { bg: "#FBF2E3", fg: "#9A6B1E" };
  return (
    <span style={{
      background: c.bg, color: c.fg, fontSize: 8, fontWeight: 700,
      padding: "3px 7px", borderRadius: 20, flexShrink: 0, letterSpacing: ".03em",
    }}>{children}</span>
  );
}
