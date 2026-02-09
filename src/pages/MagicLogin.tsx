import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiGet, setToken } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

const MagicLogin = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Signing you in...");
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Login token is missing.");
      return;
    }

    const login = async () => {
      try {
        const payload = await apiGet(`/api/auth/magic?token=${encodeURIComponent(token)}`);
        if (payload?.token) {
          setToken(payload.token);
          await refreshUser();
          setStatus("success");
          setMessage("You are now signed in.");
        } else {
          throw new Error("Missing token.");
        }
      } catch (error) {
        console.error("Magic login error:", error);
        setStatus("error");
        setMessage("This login link is invalid or expired.");
      }
    };

    login();
  }, [searchParams, refreshUser]);

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Magic Login</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent>
            {status === "success" && (
              <Button className="w-full" onClick={() => navigate("/my-applications")}>
                Go to My Applications
              </Button>
            )}
            {status === "error" && (
              <Button asChild className="w-full">
                <a href="/applicant-login">Request Magic Link</a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
};

export default MagicLogin;
