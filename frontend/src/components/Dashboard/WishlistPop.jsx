import React from "react";

export default function WishlistPop({ pendingMode = false, onBlockedAction }) {
  return (
    <div className="ud-wl">
      <button
        className="ud-link ud-link-small ud-wl-btn"
        type="button"
        aria-expanded="false"
        onClick={(e) => {
          if (pendingMode) {
            e.preventDefault();
            onBlockedAction?.();
          }
        }}
        style={{ color: "#000", fontSize: 18, fontWeight: 900 }}
      >
        ♡
      </button>

      <div className="ud-wl-pop" role="dialog" aria-label="Wishlist">
        <div className="ud-wl-pop-inner">
          <div style={{ padding: 6 }}>Wishlist coming soon.</div>
        </div>
      </div>
    </div>
  );
}

export function MyLearningPop({ pendingMode = false, onBlockedAction }) {
  return (
    <div className="ud-ml" id="myLearning">
      <button
        className="ud-link ud-link-small ud-ml-btn"
        type="button"
        aria-expanded="false"
        onClick={(e) => {
          if (pendingMode) {
            e.preventDefault();
            onBlockedAction?.();
          }
        }}
      >
        My learning
      </button>

      <div className="ud-ml-pop" role="dialog" aria-label="My learning">
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
    </div>
  );
}
