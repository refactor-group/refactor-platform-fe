"use client"

import { useState, type FormEvent, type ChangeEvent } from "react"
import type { User, NewUser } from "@/types/user"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ProfileInfoFormProps {
    user: User
    onSubmit: (updatedUser: User) => Promise<void>
    isSubmitting: boolean
}

export function ProfileInfoUpdateForm({ user, onSubmit, isSubmitting }: ProfileInfoFormProps) {
    const [formData, setFormData] = useState<User>({
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        display_name: user.display_name,
        password: "",
    })
    const [errors, setErrors] = useState<Record<string, string>>({})

    const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData((prev) => ({ ...prev, [name]: value }))

        // Clear error when user types
        if (errors[name]) {
            setErrors((prev) => {
                const newErrors = { ...prev }
                delete newErrors[name]
                return newErrors
            })
        }
    }

    const validateForm = () => {
        const newErrors: Record<string, string> = {}

        if (!formData.first_name.trim()) {
            newErrors.first_name = "First name is required"
        }

        if (!formData.last_name.trim()) {
            newErrors.last_name = "Last name is required"
        }

        if (!formData.display_name.trim()) {
            newErrors.display_name = "Display name is required"
        }

        if (!formData.email.trim()) {
            newErrors.email = "Email is required"
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = "Please enter a valid email address"
        }

        if (!formData.password?.trim()) {
            newErrors.password = "Current password is required for verification"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        await onSubmit({
            ...formData
        })
        setFormData((prev) => ({ ...prev, password: "" }))
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                        id="first_name"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        placeholder="Enter your first name"
                        className={errors.first_name ? "border-red-500" : ""}
                    />
                    {errors.first_name && <p className="text-sm text-red-500">{errors.first_name}</p>}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                        id="last_name"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        placeholder="Enter your last name"
                        className={errors.last_name ? "border-red-500" : ""}
                    />
                    {errors.last_name && <p className="text-sm text-red-500">{errors.last_name}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                    id="display_name"
                    name="display_name"
                    value={formData.display_name}
                    onChange={handleInputChange}
                    placeholder="Enter your display name"
                    className={errors.display_name ? "border-red-500" : ""}
                />
                {errors.display_name && <p className="text-sm text-red-500">{errors.display_name}</p>}
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter your email"
                    className={errors.email ? "border-red-500" : ""}
                />
                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            </div>

            <div className="border-t pt-4 mt-6">
                <div className="space-y-2">
                    <Label htmlFor="password">Current Password (required to save changes)</Label>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        value={formData.password?.trim()}
                        onChange={handleInputChange}
                        placeholder="Enter your current password"
                        className={errors.password ? "border-red-500" : ""}
                    />
                    {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                </div>
            </div>

            <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <>
                            <span className="mr-2">Saving...</span>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        </>
                    ) : (
                        "Save Profile"
                    )}
                </Button>
            </div>
        </form>
    )
}
