/**
 * App — route table + a skip-to-content link. Routes are lazy-loaded so the
 * heavy Space room (camera, recap, codecs) isn't in the landing bundle.
 */
import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { IrisShutter } from "@/components/brand/IrisShutter";

const Landing = lazy(() => import("@/routes/Landing"));
const Create = lazy(() => import("@/routes/Create"));
const Join = lazy(() => import("@/routes/Join"));
const Space = lazy(() => import("@/routes/Space"));
const NotFound = lazy(() => import("@/routes/NotFound"));

/** Full-page suspense fallback — the iris-shutter loading spinner. */
function RouteFallback() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <IrisShutter size={96} ariaLabel="Loading Vantage" />
    </div>
  );
}

export default function App() {
  return (
    <>
      {/* Accessibility: jump straight to <main id="main"> */}
      <a
        href="#main"
        className="sr-only z-[100] rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to content
      </a>

      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/create" element={<Create />} />
          <Route path="/s/:code" element={<Space />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}
