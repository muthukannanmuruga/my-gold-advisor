import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Trash2 } from "lucide-react";
import { useToast } from "./ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";

interface Purchase {
  id: string;
  weight_grams: number;
  purchase_date: string;
  purchase_price_per_gram: number;
  carat: number;
  total_amount: number;
  description: string | null;
  created_at: string;
}

interface PurchasesListProps {
  refreshTrigger: number;
  onPurchaseDeleted: () => void;
}

export const PurchasesList = ({ refreshTrigger, onPurchaseDeleted }: PurchasesListProps) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [purchaseToDelete, setPurchaseToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const fetchPurchases = async () => {
    try {
      const { data, error } = await supabase
        .from('gold_purchases')
        .select('*')
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error("Error fetching purchases:", error);
      toast({
        title: "Error",
        description: "Failed to load purchases",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [refreshTrigger]);

  const handleDeleteClick = (id: string) => {
    setPurchaseToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!purchaseToDelete) return;

    try {
      const { error } = await supabase
        .from('gold_purchases')
        .delete()
        .eq('id', purchaseToDelete);

      if (error) throw error;

      toast({
        title: "Purchase deleted",
        description: "Purchase removed from portfolio",
      });

      onPurchaseDeleted();
      setDeleteDialogOpen(false);
      setPurchaseToDelete(null);
    } catch (error) {
      console.error("Error deleting purchase:", error);
      toast({
        title: "Error",
        description: "Failed to delete purchase",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Gold Purchases</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Your Gold Purchases</CardTitle>
          <CardDescription>
            {purchases.length} purchase{purchases.length !== 1 ? 's' : ''} recorded
          </CardDescription>
        </CardHeader>
        <CardContent>
          {purchases.length === 0 ? (
            <p className="flex items-center justify-center h-[180px] text-gray-500 font-medium">
              No purchases recorded yet. Add your first gold purchase above!
            </p>
          ) : (
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{purchase.carat}K</Badge>
                      <span className="font-medium">{purchase.weight_grams}g</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>₹{purchase.purchase_price_per_gram.toLocaleString()}/gram</p>
                      <p>Total: ₹{purchase.total_amount.toLocaleString()}</p>
                      <p>Date: {formatDate(purchase.purchase_date)}</p>
                      {purchase.description && (
                        <p className="mt-1">{purchase.description}</p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteClick(purchase.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the purchase record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};