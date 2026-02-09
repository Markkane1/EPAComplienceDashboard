import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, LoginData } from "@/lib/validations";
import { useAuth } from "@/hooks/useAuth";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2, Shield } from "lucide-react";
import { withTimeout } from "@/lib/async";
import { createCaptcha } from "@/lib/captcha";

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [captcha, setCaptcha] = useState(() => createCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      cnic: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginData) => {
    if (captchaInput.trim() !== captcha.answer) {
      toast.error("Captcha is incorrect. Please try again.");
      setCaptcha(createCaptcha());
      setCaptchaInput("");
      return;
    }
    setIsLoading(true);
    try {
      const { error, user } = await withTimeout(
        signIn(data.cnic, data.password),
        10000,
        "Sign in timed out"
      );
      if (error) throw error;
      toast.success("Signed in successfully");
      if (user?.roles?.includes("applicant")) {
        navigate("/my-applications");
      } else {
        navigate("/dashboard");
      }
    } catch (error: unknown) {
      console.error("Login error:", error);
      const message = error instanceof Error && error.message ? error.message : null;
      toast.error(message || "Unable to sign in. Please check your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Staff Login</CardTitle>
            <CardDescription>
              Sign in to access the staff dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="cnic"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CNIC</FormLabel>
                      <FormControl>
                        <Input placeholder="XXXXX-XXXXXXX-X" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="Password" {...field} />
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
};

export default Login;
