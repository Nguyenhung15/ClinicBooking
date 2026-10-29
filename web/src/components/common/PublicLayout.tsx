import { Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import Header from "./Header";
import Footer from "./Footer";
import Chatbot from "../chatbot/Chatbot";

export interface PublicLayoutContextType {
  isLampOn: boolean;
  setIsLampOn: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function PublicLayout() {
  const location = useLocation();
  const normalizedPath = location.pathname.toLowerCase().replace(/\/+$/, "");
  const isLoginPage = normalizedPath === "/login";
  const [isLampOn, setIsLampOn] = useState(false);

  useEffect(() => {
    if (!isLoginPage) {
      setIsLampOn(true);
    } else {
      setIsLampOn(false);
    }
  }, [isLoginPage]);

  // Sync body classes
  useEffect(() => {
    if (isLoginPage) {
      document.body.classList.add("on-login-page");
      if (!isLampOn) {
        document.body.classList.add("lamp-off");
        document.body.classList.remove("lamp-on");
      } else {
        document.body.classList.add("lamp-on");
        document.body.classList.remove("lamp-off");
      }
    } else {
      document.body.classList.remove("on-login-page", "lamp-off", "lamp-on");
    }
    return () => {
      document.body.classList.remove("on-login-page", "lamp-off", "lamp-on");
    };
  }, [isLoginPage, isLampOn]);

  const showHeader = !isLoginPage || isLampOn;

  return (
    <div
      className={`public-layout ${isLoginPage ? "on-login-page" : ""} ${
        isLoginPage && !isLampOn ? "lamp-off" : "lamp-on"
      }`}
    >
      {showHeader && (
        <div className="public-header-wrapper header-visible">
          <Header />
        </div>
      )}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Outlet
          context={
            {
              isLampOn,
              setIsLampOn,
            } satisfies PublicLayoutContextType
          }
        />
      </main>
      {!isLoginPage && (
        <div className="public-footer-wrapper">
          <Footer />
        </div>
      )}
      {!isLoginPage && normalizedPath !== "/chatbot" && <Chatbot />}
    </div>
  );
}
