import { useEffect, useState } from "react";
import { Edit3, LockKeyhole, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatFDDate, formatINR, getFDStatus, getFDValueOnDate, getISTDateString, type FixedDeposit } from "@/lib/fixedDeposit";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { FixedDepositForm } from "./FixedDepositForm";
import { useToast } from "./ui/use-toast";

interface Props { refreshTrigger: number; onChanged: () => void }

export const FixedDepositsList = ({ refreshTrigger, onChanged }: Props) => {
  const [deposits, setDeposits] = useState<FixedDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FixedDeposit | null>(null);
  const [pending, setPending] = useState<{ type: "close" | "delete"; fd: FixedDeposit } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    supabase.from("fixed_deposits").select("*").order("start_date", { ascending: false }).then(({ data, error }) => {
      if (error) toast({ title: "Unable to load FDs", variant: "destructive" });
      setDeposits(data ?? []);
      setLoading(false);
    });
  }, [refreshTrigger, toast]);

  const confirmAction = async () => {
    if (!pending) return;
    const result = pending.type === "delete"
      ? await supabase.from("fixed_deposits").delete().eq("id", pending.fd.id)
      : await supabase.from("fixed_deposits").update({ closed_at: getISTDateString() }).eq("id", pending.fd.id);
    if (result.error) { toast({ title: `Unable to ${pending.type} FD`, variant: "destructive" }); return; }
    toast({ title: pending.type === "delete" ? "FD deleted" : "FD closed" });
    setPending(null);
    onChanged();
  };

  return (
    <>
      <Card>
        <CardHeader><CardTitle>Your Fixed Deposits</CardTitle><CardDescription>{deposits.length} record{deposits.length === 1 ? "" : "s"}</CardDescription></CardHeader>
        <CardContent>
          {loading ? <div className="h-40 animate-pulse bg-muted" /> : deposits.length === 0 ? <div className="flex h-40 items-center justify-center text-muted-foreground">No fixed deposits recorded yet</div> : (
            <div className="space-y-3">
              {deposits.map((fd) => {
                const status = getFDStatus(fd);
                const currentValue = getFDValueOnDate(fd);
                return (
                  <div key={fd.id} className="grid gap-4 rounded-md border p-4 lg:grid-cols-[1.2fr_1fr_1fr_auto] lg:items-center">
                    <div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{fd.fd_id}</span><Badge variant={status === "Closed" ? "outline" : status === "Matured" ? "secondary" : "default"}>{status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{fd.bank} · {fd.interest_type === "simple" ? "Simple" : "Compound"} · {fd.payout_frequency.replace("_", " ")}</p></div>
                    <div><p className="text-xs text-muted-foreground">Principal / Current value</p><p className="font-medium tabular-nums">{formatINR(Number(fd.principal))} / {formatINR(currentValue)}</p><p className="text-xs text-muted-foreground">{Number(fd.interest_rate).toFixed(2)}% p.a.</p></div>
                    <div><p className="text-xs text-muted-foreground">Term</p><p className="text-sm">{formatFDDate(fd.start_date)} – {formatFDDate(fd.maturity_date)}</p><p className="text-xs text-muted-foreground">{Number(fd.tenure_months).toFixed(2)} months · Maturity {formatINR(Number(fd.maturity_amount))}</p></div>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(fd)} aria-label={`Edit ${fd.fd_id}`}><Edit3 className="h-4 w-4" /></Button>
                      {status !== "Closed" && <Button variant="ghost" size="icon" onClick={() => setPending({ type: "close", fd })} aria-label={`Close ${fd.fd_id}`}><LockKeyhole className="h-4 w-4" /></Button>}
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setPending({ type: "delete", fd })} aria-label={`Delete ${fd.fd_id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Edit Fixed Deposit</DialogTitle><DialogDescription>Update the FD details and recalculated maturity value.</DialogDescription></DialogHeader>{editing && <FixedDepositForm deposit={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}</DialogContent></Dialog>
      <AlertDialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.type === "delete" ? "Delete this FD?" : "Close this FD?"}</AlertDialogTitle><AlertDialogDescription>{pending?.type === "delete" ? "This permanently removes the record and rebuilds the graph." : "Interest will stop accruing today. The record remains visible as Closed."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmAction}>{pending?.type === "delete" ? "Delete" : "Close FD"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </>
  );
};