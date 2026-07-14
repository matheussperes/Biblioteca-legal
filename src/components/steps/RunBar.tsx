"use client";

import { Play, RefreshCw } from "lucide-react";
import { Button, Spinner } from "@/components/ui";

/** Barra padrão de execução de um step: Executar / Executar novamente. */
export function RunBar({
  label,
  done,
  running,
  onRun,
  extra,
}: {
  label: string;
  done: boolean;
  running: boolean;
  onRun: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={onRun} disabled={running} variant={done ? "outline" : "default"}>
        {running ? (
          <Spinner className="h-4 w-4" />
        ) : done ? (
          <RefreshCw className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
        {done ? `Reexecutar ${label}` : `Executar ${label}`}
      </Button>
      {extra}
    </div>
  );
}
