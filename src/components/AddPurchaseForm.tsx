import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "./ui/form";
import { useToast } from "./ui/use-toast";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

const purchaseSchema = z.object({
  weight_grams: z.string().refine(val => parseFloat(val) > 0, "Weight must be greater than 0"),
  purchase_date: z.string().min(1, "Purchase date is required"),
  purchase_price_per_gram: z.string().refine(val => parseFloat(val) > 0, "Price must be greater than 0"),
  carat: z.string().refine(val => {
    const num = parseInt(val);
    return num >= 1 && num <= 24;
  }, "Carat must be between 1 and 24"),
  description: z.string().optional(),
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

interface AddPurchaseFormProps {
  onPurchaseAdded: () => void;
}

export const AddPurchaseForm = ({ onPurchaseAdded }: AddPurchaseFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      weight_grams: "",
      purchase_date: new Date().toISOString().split('T')[0],
      purchase_price_per_gram: "",
      carat: "22",
      description: "",
    },
  });

  const onSubmit = async (data: PurchaseFormData) => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const weightGrams = parseFloat(data.weight_grams);
      const pricePerGram = parseFloat(data.purchase_price_per_gram);
      const totalAmount = weightGrams * pricePerGram;

      const { error } = await supabase
        .from('gold_purchases')
        .insert({
          user_id: user.id,
          weight_grams: weightGrams,
          purchase_date: data.purchase_date,
          purchase_price_per_gram: pricePerGram,
          carat: parseInt(data.carat),
          total_amount: totalAmount,
          description: data.description || null,
        });

      if (error) throw error;

      toast({
        title: "Purchase added successfully!",
        description: `Added ${weightGrams}g of ${data.carat}K gold`,
      });

      form.reset();
      onPurchaseAdded();
    } catch (error) {
      console.error("Error adding purchase:", error);
      toast({
        title: "Error",
        description: "Failed to add purchase. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Gold Purchase</CardTitle>
        <CardDescription>
          Record a new gold purchase in your portfolio
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="weight_grams"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight (grams)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.001" 
                        placeholder="10.500"
                        className="placeholder:text-muted-foreground/50"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="carat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carat</FormLabel>
                    <FormControl>
                      <ToggleGroup
                        type="single"
                        value={field.value}
                        onValueChange={field.onChange}
                        className="grid grid-cols-2 gap-2"
                      >
                        <ToggleGroupItem 
                          value="22" 
                          className="w-full border data-[state=on]:bg-black data-[state=on]:text-white"
                        >
                          22K
                        </ToggleGroupItem>
                        <ToggleGroupItem 
                          value="24" 
                          className="w-full border data-[state=on]:bg-black data-[state=on]:text-white"
                        >
                          24K
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchase_price_per_gram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price per gram (₹)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        placeholder="7200.00"
                        className="placeholder:text-muted-foreground/50"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="purchase_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        className="placeholder:text-muted-foreground/50"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Gold necklace, coins, bars..."
                      className="placeholder:text-muted-foreground/50"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full"
            >
              {isSubmitting ? "Adding..." : "Add Purchase"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};