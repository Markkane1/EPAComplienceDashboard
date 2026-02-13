import { PublicLayout } from "@/ui/components/layout/PublicLayout";
import { ApplicationForm } from "@/ui/components/applications/ApplicationForm";

const Index = () => {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl md:text-3xl font-bold text-emerald-700 italic mb-8">
          Application for Compliance of Standards
        </h1>
        <ApplicationForm />
      </div>
    </PublicLayout>
  );
};

export default Index;



