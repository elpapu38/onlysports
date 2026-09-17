(function () {
  var scriptEl = document.currentScript;
  var src = scriptEl ? scriptEl.dataset.src : null;

  document.addEventListener("DOMContentLoaded", function () {
    var video = document.getElementById("hls-player");
    if (!src || !video) return;

    if (window.Hls && window.Hls.isSupported()) {
      var hls = new window.Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(window.Hls.Events.ERROR, function (_event, data) {
        if (data && data.fatal) {
          video.outerHTML =
            '<p class="text-neutral-500 text-sm p-4">No se pudo reproducir este stream (puede tener restricciones de CORS, un token vencido, o requerir DRM).</p>';
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari sabe reproducir HLS nativo sin hls.js.
      video.src = src;
    } else {
      video.outerHTML = '<p class="text-neutral-500 text-sm p-4">Tu navegador no puede reproducir este stream (M3U8/HLS).</p>';
    }
  });
})();
