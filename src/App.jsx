import { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Nav, ToastProvider, useSpotlight } from "./components/ui.jsx";
import Landing from "./pages/Landing.jsx";
import NewRun from "./pages/NewRun.jsx";
import RunPage from "./pages/RunPage.jsx";
import History from "./pages/History.jsx";
import NotFound from "./pages/NotFound.jsx";

function Page({ children }) {
  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      {children}
    </motion.main>
  );
}

export default function App() {
  const loc = useLocation();
  useSpotlight();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  return (
    <ToastProvider>
      <Nav />
      <AnimatePresence mode="wait">
        <Routes location={loc} key={loc.pathname}>
          <Route path="/" element={<Page><Landing /></Page>} />
          <Route path="/new" element={<Page><NewRun /></Page>} />
          <Route path="/run/:id" element={<Page><RunPage /></Page>} />
          <Route path="/runs" element={<Page><History /></Page>} />
          <Route path="*" element={<Page><NotFound /></Page>} />
        </Routes>
      </AnimatePresence>
    </ToastProvider>
  );
}
