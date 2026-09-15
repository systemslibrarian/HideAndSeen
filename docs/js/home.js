(function () {
  "use strict";
  const canvas = document.getElementById("heroQr");
  if (!canvas) return;
  const symbol = QR.build("https://ciphermuseum.com", { secret: "MEET AT 7" });
  HideAndSeenRender.draw(canvas, symbol.matrix, { size: 360 });
})();
