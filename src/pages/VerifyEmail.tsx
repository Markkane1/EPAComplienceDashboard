import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Verification token is missing.");
      return;
    }

    const verify = async () => {
      try {
        await apiGet(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        setStatus("success");
        setMessage("Your email has been verified. You can now sign in.");
      } catch (error) {
        console.error("Verify email error:", error);
        setStatus("error");
        setMessage("This verification link is invalid or expired.");
      }
    };

    verify();
  }, [searchParams]);

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Email Verification</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            {status !== "loading" && (
              <Button asChild className="w-full">
                <Link to="/applicant-login">Request Magic Link</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
};

export default VerifyEmail;
