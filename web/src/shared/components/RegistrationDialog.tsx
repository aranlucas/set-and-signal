import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { hasData, useStore } from "@/app/store/useStore";
import { BIO, getConfig, passkeyRegister } from "@/shared/lib/api";
import { toast } from "@/shared/lib/toast";
import { createRegistrationFormSchema } from "@/shared/lib/form-schemas";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";

interface RegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RegistrationFormValues {
  name: string;
  inviteCode: string;
}

function RegistrationDialogContent({ open, onOpenChange }: RegistrationDialogProps) {
  const { t } = useTranslation();
  const setUser = useStore((state) => state.setUser);
  const pushState = useStore((state) => state.pushState);
  const pullState = useStore((state) => state.pullState);
  const configQuery = useQuery({
    queryKey: ["config"],
    queryFn: getConfig,
    select: (config) => config.invite_only,
    enabled: open,
  });
  const inviteOnly = configQuery.data ?? false;
  const {
    handleSubmit,
    register,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegistrationFormValues>({
    defaultValues: { name: "", inviteCode: "" },
    resolver: valibotResolver(createRegistrationFormSchema(t, inviteOnly)),
  });

  const registerProfile = async (values: RegistrationFormValues) => {
    const trimmedName = values.name.trim();
    const trimmedInviteCode = values.inviteCode.trim();

    try {
      const user = await passkeyRegister(trimmedName, trimmedInviteCode);
      setUser(user);
      onOpenChange(false);
      reset();
      if (hasData(useStore.getState().appState)) {
        await pushState();
        toast(
          t(
            "account.profileCreatedDataDeviceMoved",
            "Profile created — data from this device moved into it",
          ),
        );
      } else {
        await pullState();
        toast(t("account.welcome", "Welcome, {{name}}", { name: user.name }));
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.name === "NotAllowedError" || error.name === "AbortError")
      )
        return;
      toast(
        error instanceof Error && error.message
          ? error.message
          : t("account.registrationFailed", "Registration failed"),
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xs rounded-xl bg-modal p-5 shadow-2xl">
        <form onSubmit={handleSubmit(registerProfile)}>
          <DialogHeader>
            <DialogTitle>{t("account.createProfile", "Create your profile")}</DialogTitle>
            <DialogDescription>
              {t(
                "account.registration.passkeyInstructions",
                "Pick a name, then confirm with {{provider}}. The passkey is saved in your device — no password needed.",
                { provider: BIO },
              )}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup className="mt-4 gap-3">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="registration-name">
                {t("account.yourName", "Your name")}
              </FieldLabel>
              <Input
                id="registration-name"
                maxLength={40}
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>
            {inviteOnly && (
              <Field data-invalid={!!errors.inviteCode}>
                <FieldLabel htmlFor="registration-invite-code">
                  {t("customExercise.inviteCode", "Invite code")}
                </FieldLabel>
                <Input
                  id="registration-invite-code"
                  maxLength={40}
                  aria-invalid={!!errors.inviteCode}
                  {...register("inviteCode")}
                  onChange={(event) =>
                    setValue("inviteCode", event.target.value.toUpperCase(), {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  className="text-center font-semibold tracking-widest"
                />
                <FieldDescription>
                  {t(
                    "customExercise.appInviteOnlyEnterCode",
                    "This app is invite-only — enter the code you were given.",
                  )}
                </FieldDescription>
                <FieldError errors={[errors.inviteCode]} />
              </Field>
            )}
          </FieldGroup>
          <DialogFooter className="mt-4">
            <Button type="submit" variant="default" disabled={isSubmitting}>
              {t("account.createPasskey", "Create passkey")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function RegistrationDialog(props: RegistrationDialogProps) {
  return <RegistrationDialogContent {...props} />;
}
