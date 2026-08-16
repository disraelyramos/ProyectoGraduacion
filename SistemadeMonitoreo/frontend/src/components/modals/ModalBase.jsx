import React, { useEffect } from "react";
import { FiX } from "react-icons/fi";

import "../../styles/modal-base.css";

const ModalBase = ({
  isOpen,
  title,
  children,
  footer = null,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="app-modal-overlay"
      onMouseDown={handleOverlayClick}
      role="presentation"
    >
      <section
        className="app-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
      >
        <header className="app-modal__header">
          <h2
            id="app-modal-title"
            className="app-modal__title"
          >
            {title}
          </h2>

          <button
            type="button"
            className="app-modal__close"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <FiX />
          </button>
        </header>

        <div className="app-modal__content">
          {children}
        </div>

        {footer && (
          <footer className="app-modal__footer">
            {footer}
          </footer>
        )}
      </section>
    </div>
  );
};

export default ModalBase;