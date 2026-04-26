import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-card !text-foreground !border !border-border-strong !shadow-lg !rounded-xl !backdrop-blur-xl",
          title: "!font-medium",
          description: "!text-muted-foreground",
          actionButton: "!bg-primary !text-primary-foreground",
          cancelButton: "!bg-muted !text-muted-foreground",
          success: "!border-success/40",
          error: "!border-destructive/40",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
