import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { apiGet } from "@/lib/api";
import { trackingIdSchema, TrackingIdData } from "@/lib/validations";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { StatusBadge } from "@/components/applications/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Search, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { HearingInfo, TrackedApplication } from "@/types/tracking";
import { toast } from "sonner";
import { withTimeout } from "@/lib/async";

const Track = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [application, setApplication] = useState<TrackedApplication | null>(null);
  const [hearings, setHearings] = useState<HearingInfo[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<TrackingIdData>({
    resolver: zodResolver(trackingIdSchema),
    defaultValues: { tracking_id: "" },
  });

  const onSubmit = async (data: TrackingIdData) => {
    const trackingId = data.tracking_id.trim().toUpperCase();
    setIsSearching(true);
    setNotFound(false);
    setErrorMessage(null);
    setApplication(null);
    setHearings([]);

    try {
      // Use secure function to get application
      const appResult = await withTimeout(
        apiGet(`/api/public/applications/${trackingId}`),
        10000,
        "Tracking lookup timed out"
      );

      if (appResult && appResult.length > 0) {
        setApplication(appResult[0] as TrackedApplication);

        // Get hearings using secure function
        const hearingsResult = await withTimeout(
          apiGet(`/api/public/applications/${trackingId}/hearings`),
          10000,
          "Hearing lookup timed out"
        );
        if (hearingsResult) {
          setHearings(hearingsResult as HearingInfo[]);
        }
      } else {
        setNotFound(true);
      }
    } catch (error: unknown) {
      console.error("Search error:", error);
      const message = error instanceof Error ? error.message : "Unable to fetch tracking details.";
      setErrorMessage(message);
      toast.error("Unable to fetch tracking details. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Track Your Application</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Enter your tracking ID to view the current status of your application.
          </p>
        </div>

        <Card className="max-w-xl mx-auto mb-8">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2">
                <FormField
                  control={form.control}
                  name="tracking_id"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input
                          placeholder="Enter tracking ID (e.g., EPD-XXXXXXXX)"
                          {...field}
                          className="uppercase"
                          onChange={(event) =>
                            field.onChange(event.target.value.toUpperCase())
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isSearching}>
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {notFound && (
          <Card className="max-w-xl mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">
                No application found with that tracking ID. Please check the ID and try again.
              </p>
            </CardContent>
          </Card>
        )}

        {errorMessage && (
          <Card className="max-w-xl mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">{errorMessage}</p>
            </CardContent>
          </Card>
        )}

        {application && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    {application.tracking_id}
                  </CardTitle>
                  <CardDescription>{application.application_type}</CardDescription>
                </div>
                <StatusBadge status={application.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Applicant</p>
                  <p className="font-medium">{application.applicant_name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Submitted</p>
                  <p className="font-medium">
                    {format(new Date(application.created_at), "PPP")}
                  </p>
                </div>
                {application.company_name && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Company</p>
                    <p className="font-medium">{application.company_name}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                  <p className="font-medium">
                    {format(new Date(application.updated_at), "PPP")}
                  </p>
                </div>
              </div>

              {hearings.length > 0 && (
                <div>
                  <h3 className="font-medium flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4" />
                    Scheduled Hearings
                  </h3>
                  <div className="space-y-2">
                    {hearings.map((hearing) => (
                      <div
                        key={hearing.id}
                        className="p-3 bg-muted rounded-lg flex justify-between items-center"
                      >
                        <span className="capitalize">{hearing.hearing_type} Hearing</span>
                        <span className="font-medium">
                          {format(new Date(hearing.hearing_date), "PPP 'at' p")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </PublicLayout>
  );
};

export default Track;
