import { Link } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

const Signup = () => {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <UserPlus className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Applicant Signup Disabled</CardTitle>
            <CardDescription>
              Applicants are registered automatically when an application is submitted.
              Use the magic link sent to your email to access and update your application.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/">Submit Application</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/applicant-login">Request Magic Link</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </PublicLayout>
  );
};

export default Signup;
