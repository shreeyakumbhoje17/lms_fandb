import { useEffect, useRef, useState } from "react";

export default function MyLearningPop({ pendingMode = false, onBlockedAction }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const openNow = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setOpen(true);
  };

  const closeSoon = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    return () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <div
      className="ud-ml"
      id="myLearning"
      style={{ position: "relative" }}
      onMouseEnter={openNow}
      onMouseLeave={closeSoon}
    >
      <button
        className="ud-link ud-link-small ud-ml-btn"
        type="button"
        aria-expanded={open ? "true" : "false"}
        onClick={(e) => {
          if (pendingMode) {
            e.preventDefault();
            onBlockedAction?.();
            return;
          }
          setOpen((v) => !v);
        }}
      >
        My learning
      </button>

      {open && (
        <div
          className="ud-ml-pop"
          role="dialog"
          aria-label="My learning"
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          style={{
            position: "absolute",
            left: 0,
            top: "120%",
            zIndex: 10000,
          }}
        >
          <div className="ud-ml-pop-inner">
            <a className="ud-ml-item" href="#">
              <div className="ud-ml-thumb" />
              <div className="ud-ml-info">
                <div className="ud-ml-title">
                  Deep Learning A-Z 2025: Neural Networks, AI &amp; ChatGPT
                </div>
                <div className="ud-ml-progress">
                  <span className="ud-ml-bar">
                    <span style={{ width: "8%" }} />
                  </span>
                </div>
              </div>
            </a>

            <a className="ud-ml-item" href="#">
              <div className="ud-ml-thumb ud-ml-thumb2" />
              <div className="ud-ml-info">
                <div className="ud-ml-title">
                  Artificial Intelligence A-Z 2025: Agentic AI, Gen AI, RL
                </div>
                <div className="ud-ml-progress">
                  <span className="ud-ml-bar">
                    <span style={{ width: "12%" }} />
                  </span>
                </div>
              </div>
            </a>

            <a className="ud-ml-item" href="#">
              <div className="ud-ml-thumb ud-ml-thumb3" />
              <div className="ud-ml-info">
                <div className="ud-ml-title">
                  Full Oracle SQL tutorials with practical exercises
                </div>
                <div className="ud-ml-progress">
                  <span className="ud-ml-bar">
                    <span style={{ width: "6%" }} />
                  </span>
                </div>
              </div>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
