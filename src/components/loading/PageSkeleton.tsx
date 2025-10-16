import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';

export const DashboardSkeleton = () => (
  <div className="min-h-screen bg-background p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <Skeleton className="h-9 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </Card>
    </div>
  </div>
);

export const CampaignsSkeleton = () => (
  <div className="min-h-screen bg-background p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      <div className="flex items-center gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-64" />
      </div>

      <div className="grid gap-4">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-full max-w-md" />
                <div className="grid grid-cols-4 gap-4">
                  {[...Array(4)].map((_, j) => (
                    <div key={j}>
                      <Skeleton className="h-8 w-16 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  </div>
);

export const DetailSkeleton = () => (
  <div className="min-h-screen bg-background p-8">
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="flex-1">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-9 w-16" />
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-full" />
      </Card>

      <Card className="p-6">
        <Skeleton className="h-6 w-48 mb-4" />
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  </div>
);

export const SettingsSkeleton = () => (
  <div className="min-h-screen bg-background p-8">
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>

      <Card className="p-6">
        <Skeleton className="h-6 w-24 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      </Card>
    </div>
  </div>
);
