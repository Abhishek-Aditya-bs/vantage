/**
 * 404 — on-brand: the mascot, an ASCII frame, and a route home.
 */
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/brand/Mascot";
import { AppHeader } from "@/components/AppHeader";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <main
        id="main"
        className="mx-auto grid min-h-[70vh] w-full max-w-lg place-items-center px-5 py-16 text-center"
      >
        <div className="flex flex-col items-center gap-6">
          <Mascot size={96} />
          <pre
            aria-hidden="true"
            className="font-mono text-[0.7rem] leading-tight text-muted-foreground"
          >{`┌───────────────┐
│  4 0 4 · ▒▒▒  │
│  out of frame │
└───────────────┘`}</pre>
          <div>
            <h1 className="font-display text-4xl font-bold tracking-tight">
              Out of frame
            </h1>
            <p className="mt-2 text-muted-foreground">
              That page isn&rsquo;t in the viewfinder. Let&rsquo;s get you back.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/">Back to Vantage</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
