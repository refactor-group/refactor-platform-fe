"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useUser, useUserMutation } from "@/lib/api/users"
import { ProfileInfoUpdateForm } from "@/components/ui/members/profile-info-update-form"
import { PasswordUpdateForm } from "@/components/ui/members/password-update-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStore } from "@/lib/providers/auth-store-provider"
import { Id } from "@/types/general"
import { User, NewUserPassword } from "@/types/user"
import { useUserPasswordMutation } from "@/lib/api/users"
import { useLogoutUser } from "@/lib/hooks/use-logout-user"

export function MemberProfileContainer({ userId }: { userId: Id }) {
    const { userId: currentUserId, logout } = useAuthStore((state) => state)
    const { user, isLoading, refresh } = useUser(userId)
    const { update: updateUser, isLoading: isUpdating } = useUserMutation()
    const { update: updatePassword } = useUserPasswordMutation()
    const [activeTab, setActiveTab] = useState("profile")
    const logoutUser = useLogoutUser()

    const handleProfileUpdate = async (
        updatedUser: User
    ) => {
        try {
            await updateUser(userId, updatedUser)
            refresh()
        } catch (error) {
            console.error("Error updating profile:", error)
        }
    }

    const handlePasswordUpdate = async (updatedPassword: NewUserPassword) => {
        try {
            await updatePassword(userId, updatedPassword)
            // Logout the user when the password is updated
            logoutUser()
        } catch (error) {
            console.error("Error updating password:", error)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                    <p className="mt-2">Loading user member profile...</p>
                </div>
            </div>
        )
    }

    // Only allow users to update their own information
    if (userId !== currentUserId) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle><p className="text-lg font-bold">You can only update your own profile.</p></CardTitle>
                </CardHeader>
                <CardContent>
                    <CardDescription>
                        <p className="text-lg font-bold">To update your profile, log in as the user you want to update.</p>
                    </CardDescription>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="max-w-3xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>Member Profile</CardTitle>
                    <CardDescription>Update your account information and password</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="profile">Profile Information</TabsTrigger>
                            <TabsTrigger value="password">Password</TabsTrigger>
                        </TabsList>
                        <TabsContent value="profile" className="mt-6">
                            <ProfileInfoUpdateForm user={user} onSubmit={handleProfileUpdate} isSubmitting={isUpdating} />
                        </TabsContent>
                        <TabsContent value="password" className="mt-6">
                            <PasswordUpdateForm onSubmit={handlePasswordUpdate} isSubmitting={isUpdating} />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}
