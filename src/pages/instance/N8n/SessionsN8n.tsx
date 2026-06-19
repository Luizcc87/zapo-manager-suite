/* eslint-disable @typescript-eslint/no-explicit-any */
import { ColumnDef, RowSelectionState, SortingState } from "@tanstack/react-table";
import { Delete, ListCollapse, MessageSquare, MoreHorizontal, Pause, Play, RotateCcw, StopCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";

import { Button } from "@evoapi/design-system/button";
import { Card, CardContent, CardHeader, CardTitle } from "@evoapi/design-system/card";
import { Checkbox } from "@evoapi/design-system/checkbox";
import { Label } from "@evoapi/design-system/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@evoapi/design-system/select";
import { Textarea } from "@evoapi/design-system/textarea";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@evoapi/design-system/dropdown-menu";
import { Input } from "@/components/ui/input";

import { useInstance } from "@/contexts/InstanceContext";

import { api } from "@/lib/queries/api";
import { useFetchSessionsN8n } from "@/lib/queries/n8n/fetchSessionsN8n";
import { useManageN8n } from "@/lib/queries/n8n/manageN8n";

import { IntegrationSession } from "@/types/evolution.types";

interface FilterState {
  name: string;
  number: string;
  status: string;
  time: string;
  customCondition: "more" | "less";
  customValue: string;
  customUnit: "minutes" | "hours" | "days";
}

const initialFilter: FilterState = {
  name: "",
  number: "",
  status: "all",
  time: "all",
  customCondition: "more",
  customValue: "",
  customUnit: "minutes",
};

function customMinutes(value: string, unit: FilterState["customUnit"]) {
  const v = parseInt(value);
  if (!v || isNaN(v) || v <= 0) return null;
  if (unit === "hours") return v * 60;
  if (unit === "days") return v * 1440;
  return v;
}

function matchesTime(updatedAt: string, filter: FilterState) {
  if (filter.time === "all") return true;
  const diffMin = (Date.now() - new Date(updatedAt).getTime()) / 60000;

  if (filter.time === "custom") {
    const m = customMinutes(filter.customValue, filter.customUnit);
    if (m === null) return true;
    return filter.customCondition === "more" ? diffMin > m : diffMin <= m;
  }

  if (filter.time.startsWith(">")) {
    const m = parseInt(filter.time.slice(1));
    return diffMin > m;
  }
  return diffMin <= parseInt(filter.time);
}

function SessionsN8n({ n8nId }: { n8nId?: string }) {
  const { t } = useTranslation();
  const { instance } = useInstance();
  const { changeStatusN8n } = useManageN8n();

  const [open, setOpen] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [filter, setFilter] = useState<FilterState>(initialFilter);
  const [appliedFilter, setAppliedFilter] = useState<FilterState>(initialFilter);
  const [perPage, setPerPage] = useState(9);
  const [shown, setShown] = useState(9);
  const [massStatus, setMassStatus] = useState("opened");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<string>("");
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);

  const { data: sessions, refetch } = useFetchSessionsN8n({
    instanceName: instance?.name,
    n8nId,
    enabled: open,
  });

  const filteredSessions = useMemo(() => {
    const list = sessions ?? [];
    const name = appliedFilter.name.trim().toLowerCase();
    const number = appliedFilter.number.trim();
    return list.filter((s) => {
      if (name && !s.pushName?.toLowerCase().includes(name)) return false;
      if (number && !s.remoteJid.includes(number)) return false;
      if (appliedFilter.status !== "all" && s.status !== appliedFilter.status) return false;
      if (!matchesTime(s.updatedAt, appliedFilter)) return false;
      return true;
    });
  }, [sessions, appliedFilter]);

  const displayed = filteredSessions.slice(0, shown);
  const selectedJids = useMemo(
    () => Object.keys(rowSelection).filter((k) => rowSelection[k]).map((idx) => displayed[Number(idx)]?.remoteJid).filter(Boolean) as string[],
    [rowSelection, displayed],
  );

  useEffect(() => {
    setShown(perPage);
    setRowSelection({});
  }, [appliedFilter, perPage]);

  const onReset = () => {
    refetch();
  };

  const applyFilters = () => {
    setAppliedFilter(filter);
  };

  const clearFilters = () => {
    setFilter(initialFilter);
    setAppliedFilter(initialFilter);
  };

  const changeStatus = async (remoteJid: string, status: string) => {
    try {
      if (!instance) return;
      await changeStatusN8n({ instanceName: instance.name, token: instance.token, remoteJid, status });
      toast.success(t("n8n.toast.success.status"));
      onReset();
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(`Error : ${error?.response?.data?.response?.message}`);
    }
  };

  const applyMass = async () => {
    if (selectedJids.length === 0) {
      toast.error(t("sessions.mass.noneSelected"));
      return;
    }
    try {
      if (!instance) return;
      await Promise.all(
        selectedJids.map((remoteJid) =>
          changeStatusN8n({ instanceName: instance.name, token: instance.token, remoteJid, status: massStatus }),
        ),
      );
      toast.success(t("sessions.mass.success"));
      setRowSelection({});
      onReset();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.response?.message ?? t("sessions.mass.error"));
    }
  };

  const openSend = (remoteJid: string) => {
    setSendTarget(remoteJid);
    setSendText("");
    setSendOpen(true);
  };

  const sendMessage = async () => {
    if (!sendText.trim()) {
      toast.error(t("sessions.send.empty"));
      return;
    }
    try {
      if (!instance) return;
      setSending(true);
      await api.post(
        `/message/sendText/${instance.name}`,
        { number: sendTarget, text: sendText },
        { headers: { apikey: instance.token } },
      );
      toast.success(t("sessions.send.success"));
      setSendOpen(false);
      setSendText("");
      setSendTarget("");
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error?.response?.data?.response?.message ?? error?.message ?? t("sessions.send.error"));
    } finally {
      setSending(false);
    }
  };

  const columns: ColumnDef<IntegrationSession>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t("sessions.mass.selectAll")}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={t("sessions.mass.selectAll")}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "remoteJid",
      header: () => <div className="text-center">{t("n8n.sessions.table.remoteJid")}</div>,
      cell: ({ row }) => <div>{row.getValue("remoteJid")}</div>,
    },
    {
      accessorKey: "pushName",
      header: () => <div className="text-center">{t("n8n.sessions.table.pushName")}</div>,
      cell: ({ row }) => <div>{row.getValue("pushName")}</div>,
    },
    {
      accessorKey: "sessionId",
      header: () => <div className="text-center">{t("n8n.sessions.table.sessionId")}</div>,
      cell: ({ row }) => <div>{row.getValue("sessionId")}</div>,
    },
    {
      accessorKey: "status",
      header: () => <div className="text-center">{t("n8n.sessions.table.status")}</div>,
      cell: ({ row }) => <div>{row.getValue("status")}</div>,
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        const session = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <span className="sr-only">{t("n8n.sessions.table.actions.title")}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t("n8n.sessions.table.actions.title")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {session.status !== "opened" && (
                <DropdownMenuItem onClick={() => changeStatus(session.remoteJid, "opened")}>
                  <Play className="mr-2 h-4 w-4" />
                  {t("n8n.sessions.table.actions.open")}
                </DropdownMenuItem>
              )}
              {session.status !== "paused" && session.status !== "closed" && (
                <DropdownMenuItem onClick={() => changeStatus(session.remoteJid, "paused")}>
                  <Pause className="mr-2 h-4 w-4" />
                  {t("n8n.sessions.table.actions.pause")}
                </DropdownMenuItem>
              )}
              {session.status !== "closed" && (
                <DropdownMenuItem onClick={() => changeStatus(session.remoteJid, "closed")}>
                  <StopCircle className="mr-2 h-4 w-4" />
                  {t("n8n.sessions.table.actions.close")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => openSend(session.remoteJid)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                {t("sessions.actions.sendMessage")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeStatus(session.remoteJid, "delete")}>
                <Delete className="mr-2 h-4 w-4" />
                {t("n8n.sessions.table.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  const timePresets: string[] = ["all", "5", "10", "15", "20", "30", "60", ">60", ">120", ">300", ">1440", "custom"];
  const statusPresets: string[] = ["all", "opened", "paused", "closed"];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <ListCollapse size={16} className="mr-1" />
          <span className="hidden md:inline">{t("n8n.sessions.label")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("n8n.sessions.label")}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pr-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("sessions.filters.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label>{t("sessions.filters.name")}</Label>
                  <Input
                    placeholder={t("sessions.filters.namePlaceholder")}
                    value={filter.name}
                    onChange={(e) => setFilter((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("sessions.filters.number")}</Label>
                  <Input
                    placeholder={t("sessions.filters.numberPlaceholder")}
                    value={filter.number}
                    onChange={(e) => setFilter((p) => ({ ...p, number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("sessions.filters.status")}</Label>
                  <Select value={filter.status} onValueChange={(v) => setFilter((p) => ({ ...p, status: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusPresets.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`sessions.filters.statusOptions.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("sessions.filters.time")}</Label>
                  <Select value={filter.time} onValueChange={(v) => setFilter((p) => ({ ...p, time: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timePresets.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`sessions.filters.timeOptions.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {filter.time === "custom" && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Select
                    value={filter.customCondition}
                    onValueChange={(v: "more" | "less") => setFilter((p) => ({ ...p, customCondition: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="more">{t("sessions.filters.custom.more")}</SelectItem>
                      <SelectItem value="less">{t("sessions.filters.custom.less")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={1}
                    placeholder={t("sessions.filters.custom.valuePlaceholder")}
                    value={filter.customValue}
                    onChange={(e) => setFilter((p) => ({ ...p, customValue: e.target.value }))}
                  />
                  <Select
                    value={filter.customUnit}
                    onValueChange={(v: FilterState["customUnit"]) => setFilter((p) => ({ ...p, customUnit: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">{t("sessions.filters.custom.minutes")}</SelectItem>
                      <SelectItem value="hours">{t("sessions.filters.custom.hours")}</SelectItem>
                      <SelectItem value="days">{t("sessions.filters.custom.days")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={applyFilters} size="sm">
                  {t("sessions.filters.apply")}
                </Button>
                <Button onClick={clearFilters} size="sm" variant="outline">
                  {t("sessions.filters.clear")}
                </Button>
                <Button onClick={onReset} size="sm" variant="outline">
                  <RotateCcw size={14} className="mr-1" />
                  {t("button.refresh")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {selectedJids.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("sessions.mass.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="text-sm text-muted-foreground">
                    {t("sessions.mass.selected", { count: selectedJids.length })}
                  </div>
                  <div className="flex-1 min-w-[180px] space-y-1">
                    <Label>{t("sessions.mass.newStatus")}</Label>
                    <Select value={massStatus} onValueChange={setMassStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opened">{t("n8n.sessions.table.actions.open")}</SelectItem>
                        <SelectItem value="paused">{t("n8n.sessions.table.actions.pause")}</SelectItem>
                        <SelectItem value="closed">{t("n8n.sessions.table.actions.close")}</SelectItem>
                        <SelectItem value="delete">{t("n8n.sessions.table.actions.delete")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={applyMass} size="sm">
                    {t("sessions.mass.apply")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <DataTable
            columns={columns}
            data={displayed}
            onSortingChange={setSorting}
            state={{ sorting, rowSelection }}
            onRowSelectionChange={setRowSelection}
            enableRowSelection
            getRowId={(_, idx) => String(idx)}
            noResultsMessage={t("sessions.empty")}
          />

          <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
            <span>
              {t("sessions.pagination.showing", { shown: displayed.length, total: filteredSessions.length })}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="per-page" className="text-xs">
                {t("sessions.pagination.perPage")}
              </Label>
              <Select value={String(perPage)} onValueChange={(v) => setPerPage(parseInt(v))}>
                <SelectTrigger id="per-page" className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9">9</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              {shown < filteredSessions.length && (
                <Button size="sm" variant="outline" onClick={() => setShown((s) => Math.min(s + perPage, filteredSessions.length))}>
                  {t("sessions.pagination.showMore")}
                </Button>
              )}
              {shown < filteredSessions.length && (
                <Button size="sm" variant="outline" onClick={() => setShown(filteredSessions.length)}>
                  {t("sessions.pagination.showAll")}
                </Button>
              )}
              {shown > perPage && (
                <Button size="sm" variant="outline" onClick={() => setShown(perPage)}>
                  {t("sessions.pagination.showLess")}
                </Button>
              )}
            </div>
          </div>
        </div>

        <Dialog open={sendOpen} onOpenChange={(o) => !sending && setSendOpen(o)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("sessions.send.title")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>{t("sessions.send.to")}</Label>
                <Input value={sendTarget} disabled />
              </div>
              <div className="space-y-1">
                <Label>{t("sessions.send.messagePlaceholder")}</Label>
                <Textarea
                  rows={4}
                  placeholder={t("sessions.send.messagePlaceholder")}
                  value={sendText}
                  onChange={(e) => setSendText(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendOpen(false)} disabled={sending}>
                {t("button.cancel")}
              </Button>
              <Button onClick={sendMessage} disabled={sending}>
                {sending ? t("sessions.send.sending") : t("sessions.send.send")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

export { SessionsN8n };
