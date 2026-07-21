import React, { forwardRef, useRef, useImperativeHandle } from "react";

const SignaturePad = forwardRef(function SignaturePad(props, ref) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 600;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1a1a1a";
    ctxRef.current = ctx;
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const start = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    hasDrawnRef.current = true;
    const pos = getPos(e);
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(pos.x, pos.y);
  };

  const move = (e) => {
    if (!isDrawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    ctxRef.current.lineTo(pos.x, pos.y);
    ctxRef.current.stroke();
  };

  const end = () => {
    isDrawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => !hasDrawnRef.current,
    getDataUrl: () => canvasRef.current.toDataURL("image/png"),
    getBlob: (callback) => canvasRef.current.toBlob(callback, "image/png"),
    clear,
  }));

  return (
    <div>
      <canvas
        ref={canvasRef}
        style={styles.canvas}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <button type="button" onClick={clear} style={styles.clearBtn}>
        Effacer la signature
      </button>
    </div>
  );
});

export default SignaturePad;

const styles = {
  canvas: {
    width: "100%",
    height: 200,
    touchAction: "none",
    border: "1px solid #ccc",
    borderRadius: 8,
    background: "#fff",
    cursor: "crosshair",
  },
  clearBtn: {
    marginTop: 8,
    padding: "6px 12px",
    borderRadius: 8,
    border: "1px solid #ccc",
    background: "#fff",
    cursor: "pointer",
    fontSize: 13,
  },
};
