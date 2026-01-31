import { AcceptInviteForm } from '@/components/forms/AcceptInviteForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            Welcome!
          </CardTitle>
          <CardDescription className="text-center">
            Complete your account setup to get started
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcceptInviteForm />
        </CardContent>
      </Card>
    </div>
  )
}
