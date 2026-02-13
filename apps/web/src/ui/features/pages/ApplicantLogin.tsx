import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { applicantMagicLinkSchema, ApplicantMagicLinkData } from "@/ui/app/validations";
import { PublicLayout } from "@/ui/components/layout/PublicLayout";
import { Button } from "@/ui/components/ui/button";
import { Input } from "@/ui/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/ui/components/ui/form";
import { toast } from "sonner";
import { Loader2, User } from "lucide-react";
import { withTimeout } from "@/ui/app/async";
import { createCaptcha } from "@/ui/app/captcha";
import { authUseCases } from "@/ui/app/container";

const ApplicantLogin = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [captcha, setCaptcha] = useState(() => createCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [requestedEmail, setRequestedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const form = useForm<ApplicantMagicLinkData>({
    resolver: zodResolver(applicantMagicLinkSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ApplicantMagicLinkData) => {
    if (captchaInput.trim() !== captcha.answer) {
      toast.error("Captcha is incorrect. Please try again.");
      setCaptcha(createCaptcha());
      setCaptchaInput("");
      return;
    }
    setIsLoading(true);
    try {
      await withTimeout(
        authUseCases.magicLoginRequest({ email: data.email }),
        10000,
        "Request timed out"
      );
      setRequestSent(true);
      setRequestedEmail(data.email);
      setCooldown(60);
      setCaptcha(createCaptcha());
      setCaptchaInput("");
      toast.success("Magic link sent. Check your inbox.");
    } catch (error: unknown) {
      console.error("Applicant login error:", error);
      const message = error instanceof Error && error.message ? error.message : null;
      toast.error(message || "Unable to send magic link. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => {
      setCooldown((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Applicant Access</CardTitle>
            <CardDescription>
              Enter your email to receive a magic link to view and update your applications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestSent && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
                We sent a magic link to <span className="font-medium text-foreground">{requestedEmail}</span>. Use that
                link to sign in.
              </div>
            )}
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="applicant@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-2">
                  <FormLabel>Captcha</FormLabel>
                  <div className="flex items-center gap-2">
                    <Input value={captcha.question} readOnly />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCaptcha(createCaptcha());
                        setCaptchaInput("");
                      }}
                    >
                      Refresh
                    </Button>
                  </div>
                  <Input
                    placeholder="Answer"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || cooldown > 0}>
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {cooldown > 0 ? `Please wait ${cooldown}s` : "Send Magic Link"}
                </Button>
                {requestSent && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={isLoading || cooldown > 0}
                    onClick={() => form.handleSubmit(onSubmit)()}
                  >
                    Resend Magic Link
                  </Button>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
};

export default ApplicantLogin;



