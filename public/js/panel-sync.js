document.addEventListener("DOMContentLoaded", function () {
  var btn = document.getElementById("sync-now");
  var result = document.getElementById("sync-result");
  if (!btn) return;

  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  var csrfToken = csrfMeta ? csrfMeta.content : "";

  btn.addEventListener("click", async function () {
    btn.disabled = true;
    btn.textContent = "Sincronizando...";
    result.textContent = "";
    try {
      var res = await fetch("/panel/sync", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
      });
      var data = await res.json();
      if (!data.ok || data.summary.length === 0) {
        result.textContent = "Listo, pero ninguna fuente trajo datos nuevos (puede ser que no haya nada para sincronizar ahora mismo).";
      } else {
        result.textContent = data.summary
          .map(function (s) { return s.source + ": " + s.created + " nuevos, " + s.updated + " actualizados"; })
          .join(" · ");
      }
    } catch {
      result.textContent = "Falló la sincronización, revisá la terminal para más detalle.";
    } finally {
      btn.disabled = false;
      btn.textContent = "🔄 Sincronizar ahora";
    }
  });
});
