"use client";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { useForm } from "react-hook-form";
import { saveTradeAction } from "~/actions/trades";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useUser, SignInButton } from "@clerk/nextjs";
import { SaveIcon } from "lucide-react";

const saveTradeSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be less than 100 characters"),
  rating: z.number().min(0).max(10),
  description: z
    .string()
    .min(1, "Description is required")
    .max(500, "Description must be less than 500 characters"),
});

type SaveTradeFormData = z.infer<typeof saveTradeSchema>;

interface SaveTradeModalProps {
  isLoading?: boolean;
  fromTeamId: number;
  toTeamId: number;
}

export default function SaveTradeModal({
  isLoading = false,
  fromTeamId,
  toTeamId,
}: SaveTradeModalProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<SaveTradeFormData>({
    resolver: zodResolver(saveTradeSchema),
    defaultValues: {
      title: "",
      rating: 0,
      description: "",
    },
  });

  const handleCancel = () => {
    setOpen(false);
    form.reset();
  };

  const { user } = useUser();

  const handleOpen = () => {
    if (user?.id) {
      setOpen(true);
    }
  };

  return (
    <>
      {user?.id ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <Button
            onClick={handleOpen}
            className="w-full sm:w-auto bg-indigoMain text-primary-white hover:bg-indigoMain/70
              disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
              transition-all duration-150 ease-in-out"
          >
            <SaveIcon className="mr-2 h-5 w-5" strokeWidth={1.5} />
            Save Trade
          </Button>

          <DialogContent className="w-[95vw] max-w-[425px] mx-auto border-white/80 rounded-xl">
            <DialogHeader>
              <DialogTitle>Save Trade</DialogTitle>
              <DialogDescription>
                Add a title, rating, and description to save this trade for
                future reference.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form action={saveTradeAction} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter trade title..."
                          {...field}
                          name="title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rating *</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(parseInt(value))
                        }
                        value={field.value.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a rating" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 11 }, (_, i) => (
                            <SelectItem key={i} value={i.toString()}>
                              {i}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Rate this trade from 0-10
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Ensure rating value is submitted with the form */}
                <input
                  type="hidden"
                  name="rating"
                  value={form.watch("rating")}
                />
                {typeof fromTeamId === "number" && (
                  <input type="hidden" name="fromTeamId" value={fromTeamId} />
                )}
                {typeof toTeamId === "number" && (
                  <input type="hidden" name="toTeamId" value={toTeamId} />
                )}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the trade reasoning, benefits, etc..."
                          className="min-h-[100px]"
                          {...field}
                          name="description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto bg-indigoMain text-primary-white hover:bg-indigoMain/70
          disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
          transition-all duration-150 ease-in-out"
                  >
                    {isLoading ? "Saving..." : "Save Trade"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      ) : (
        <SignInButton mode="modal">
          <Button
            className="w-full sm:w-auto bg-indigoMain text-primary-white hover:bg-indigoMain/70
            disabled:bg-muted disabled:text-muted-foreground/70 disabled:border disabled:border-muted-foreground/30 disabled:cursor-not-allowed
            transition-all duration-150 ease-in-out"
          >
            <SaveIcon className="mr-2 h-5 w-5" strokeWidth={1.5} />
            Save Trade
          </Button>
        </SignInButton>
      )}
    </>
  );
}
