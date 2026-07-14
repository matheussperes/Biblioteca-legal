"use client";

import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Table,
  Th,
  Td,
} from "@/components/ui";
import type { DocumentDetail } from "./types";

interface LogRow {
  id: string;
  step: string;
  level: string;
  message: string;
  createdAt: string;
}

interface JobRow {
  id: string;
  step: string;
  status: string;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/** Sistema de Logs + histórico de execução (jobs). */
export function LogsPanel({ document: doc }: { document: DocumentDetail }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${doc.id}/logs`);
    const data = await res.json();
    setLogs(data.logs);
    setJobs(data.jobs);
  }, [doc.id]);

  useEffect(() => {
    load();
  }, [load, doc.status, doc.updatedAt]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a href={`/api/documents/${doc.id}/export?format=logs`} download>
          <Button variant="outline">
            <Download className="h-4 w-4" /> Exportar Logs
          </Button>
        </a>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Logs ({logs.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[32rem] overflow-auto p-0">
            <div className="divide-y divide-zinc-100 text-sm">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-2">
                  <span className="whitespace-nowrap font-mono text-xs text-zinc-400">
                    {new Date(log.createdAt).toLocaleTimeString("pt-BR")}
                  </span>
                  <Badge
                    variant={
                      log.level === "error"
                        ? "error"
                        : log.level === "warn"
                          ? "warning"
                          : "outline"
                    }
                  >
                    {log.step}
                  </Badge>
                  <span
                    className={log.level === "error" ? "text-red-700" : "text-zinc-700"}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="p-4 text-zinc-500">Nenhum log ainda.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de execução ({jobs.length})</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[32rem] overflow-auto p-0">
            <Table>
              <thead>
                <tr>
                  <Th>Step</Th>
                  <Th>Status</Th>
                  <Th>Início</Th>
                  <Th>Duração</Th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <Td>{job.step}</Td>
                    <Td>
                      <Badge
                        variant={
                          job.status === "COMPLETED"
                            ? "success"
                            : job.status === "FAILED"
                              ? "error"
                              : "default"
                        }
                      >
                        {job.status}
                      </Badge>
                      {job.error && (
                        <div className="mt-1 max-w-xs text-xs text-red-600">
                          {job.error}
                        </div>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap text-xs text-zinc-500">
                      {job.startedAt
                        ? new Date(job.startedAt).toLocaleTimeString("pt-BR")
                        : "—"}
                    </Td>
                    <Td className="text-xs text-zinc-500">
                      {job.startedAt && job.finishedAt
                        ? `${(
                            (new Date(job.finishedAt).getTime() -
                              new Date(job.startedAt).getTime()) /
                            1000
                          ).toFixed(1)} s`
                        : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
