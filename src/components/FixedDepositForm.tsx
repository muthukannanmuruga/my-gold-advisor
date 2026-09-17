import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import type { FixedDeposit, InterestType, PayoutFrequency } from "@/lib/fixedDeposit";
import { calculateMaturityAmount, calculateTenureMonths, formatINR, getISTDateString } from "@/lib/fixedDeposit";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useToast } from "./ui/use-toast";

const parseAmount = (value: string) => Number(value.replace(/,/g, ""));
const formatAmountInput = (value: string | number) => {
  const normalized = String(value).replace(/,/g, "").replace(/[^\d.]/g, "");
  const [whole = "", ...decimalParts] = normalized.split(".");
  const grouped = whole ? new Intl.NumberFormat("en-IN").format(Number(whole)) : "";
  return decimalParts.length ? `${grouped}.${decimalParts.join("")}` : grouped;
};

const formatTenure = (months: number) => Number(months.toFixed(2)).toString();

const schema = z.object({
  fd_id: z.string().trim().min(1, "FD ID is required").max(80),
  bank: z.string().trim().min(1, "Bank is required").max(120),
  principal: z.string().refine((value) => parseAmount(value) > 0, "Principal must be greater than 0"),
  start_date: z.string().min(1, "Start date is required"),
  maturity_date: z.string().min(1, "Maturity date is required"),
  interest_rate: z.string().refine((value) => Number(value) > 0, "Interest rate must be greater than 0"),
  interest_type: z.enum(["simple", "compound"]),
  payout_frequency: z.enum(["monthly", "quarterly", "at_maturity"]),
}).refine((data) => data.maturity_date > data.start_date, {
  path: ["maturity_date"],
  message: "Maturity date must be after the start date",
});

type FormValues = z.infer<typeof schema>;

interface Props {
  deposit?: FixedDeposit | null;
  onSaved: () => void;
  onCancel?: () => void;
}

export const FixedDepositForm = ({ deposit, onSaved, onCancel }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fd_id: deposit?.fd_id ?? "",
      bank: deposit?.bank ?? "",
      principal: deposit ? formatAmountInput(deposit.principal) : "",
      start_date: deposit?.start_date ?? getISTDateString(),
      maturity_date: deposit?.maturity_date ?? "",
      interest_rate: deposit ? String(deposit.interest_rate) : "",
      interest_type: (deposit?.interest_type as InterestType) ?? "simple",
      payout_frequency: (deposit?.payout_frequency as PayoutFrequency) ?? "at_maturity",
    },
  });

  useEffect(() => {
    if (!deposit) return;
    form.reset({
      fd_id: deposit.fd_id,
      bank: deposit.bank,
      principal: formatAmountInput(deposit.principal),
      start_date: deposit.start_date,
      maturity_date: deposit.maturity_date,
      interest_rate: String(deposit.interest_rate),
      interest_type: deposit.interest_type as InterestType,
      payout_frequency: deposit.payout_frequency as PayoutFrequency,
    });
  }, [deposit, form]);

  const values = form.watch();
  const preview = useMemo(() => {
    const principal = parseAmount(values.principal);
    const rate = Number(values.interest_rate);
    const validDates = values.start_date && values.maturity_date && values.maturity_date > values.start_date;
    if (!validDates || principal <= 0 || rate <= 0) return { tenure: 0, maturity: 0 };
    return {
      tenure: calculateTenureMonths(values.start_date, values.maturity_date),
      maturity: calculateMaturityAmount(
        principal,
        rate,
        values.start_date,
        values.maturity_date,
        values.interest_type,
        values.payout_frequency,
      ),
    };
  }, [values]);

  const submit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error("You must be signed in");
      const principal = parseAmount(data.principal);
      const rate = Number(data.interest_rate);
      const tenure = calculateTenureMonths(data.start_date, data.maturity_date);
      const maturity = calculateMaturityAmount(
        principal,
        rate,
        data.start_date,
        data.maturity_date,
        data.interest_type,
        data.payout_frequency,
      );
      const payload = {
        user_id: user.id,
        fd_id: data.fd_id.trim(),
        bank: data.bank.trim(),
        principal,
        start_date: data.start_date,
        maturity_date: data.maturity_date,
        interest_rate: rate,
        interest_type: data.interest_type,
        payout_frequency: data.payout_frequency,
        tenure_months: Number(tenure.toFixed(2)),
        maturity_amount: Number(maturity.toFixed(2)),
      };
      const result = deposit
        ? await supabase.from("fixed_deposits").update(payload).eq("id", deposit.id)
        : await supabase.from("fixed_deposits").insert(payload);
      if (result.error) throw result.error;
      toast({ title: deposit ? "FD updated" : "FD added", description: `${data.fd_id} has been saved successfully.` });
      if (!deposit) form.reset();
      onSaved();
    } catch (error: unknown) {
      const message = error instanceof Error && error.message.includes("fixed_deposits_user_fd_id_key")
        ? "That FD ID is already in use."
        : "Could not save this FD. Please try again.";
      toast({ title: "Unable to save FD", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField control={form.control} name="fd_id" render={({ field }) => (
            <FormItem><FormLabel>FD ID</FormLabel><FormControl><Input placeholder="FD001" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="bank" render={({ field }) => (
            <FormItem><FormLabel>Bank</FormLabel><FormControl><Input placeholder="HDFC" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="principal" render={({ field }) => (
            <FormItem><FormLabel>Principal (₹)</FormLabel><FormControl><Input inputMode="decimal" placeholder="2,00,000" {...field} onChange={(event) => field.onChange(formatAmountInput(event.target.value))} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="interest_rate" render={({ field }) => (
            <FormItem><FormLabel>Interest Rate (%)</FormLabel><FormControl><Input type="number" min="0" step="0.01" placeholder="7.25" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="start_date" render={({ field }) => (
            <FormItem><FormLabel>Start Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="maturity_date" render={({ field }) => (
            <FormItem><FormLabel>Maturity Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="interest_type" render={({ field }) => (
            <FormItem><FormLabel>Interest Type</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="simple">Simple</SelectItem><SelectItem value="compound">Compound</SelectItem></SelectContent></Select><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="payout_frequency" render={({ field }) => (
            <FormItem><FormLabel>Payout Frequency</FormLabel><Select value={field.value} onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="at_maturity">At maturity</SelectItem></SelectContent></Select><FormMessage /></FormItem>
          )} />
        </div>
        <div className="grid grid-cols-1 gap-3 border-y py-4 sm:grid-cols-2">
           <div><p className="text-xs text-muted-foreground">Tenure</p><p className="text-lg font-semibold tabular-nums">{formatTenure(preview.tenure)} months</p></div>
          <div><p className="text-xs text-muted-foreground">Maturity Amount</p><p className="text-lg font-semibold tabular-nums">{formatINR(preview.maturity, 2)}</p></div>
        </div>
        <div className="flex justify-end gap-2">
          {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          <Button type="submit" disabled={submitting}>{submitting ? "Saving..." : deposit ? "Save Changes" : "Add Fixed Deposit"}</Button>
        </div>
      </form>
    </Form>
  );
};