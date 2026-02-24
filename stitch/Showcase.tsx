import React, { useState } from 'react';
import { Button } from './components/Button';
import { Card, CardHeader, CardTitle, CardContent } from './components/Card';
import { Input } from './components/Input';
import { Badge } from './components/Badge';
import { Heading, Text } from './components/Typography';
import { colors } from './tokens';

export const StitchShowcase: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);

    const toggleLoading = () => {
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-950 p-8 space-y-12 text-slate-50">
            <div className="space-y-4">
                <Heading level={1} className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                    Stitch Design System
                </Heading>
                <Text variant="default" className="max-w-2xl">
                    Premium design components for the Axis Drone Platform.
                    Built with accessibility, responsiveness, and aesthetics in mind.
                </Text>
            </div>

            <section className="space-y-6">
                <Heading level={2}>Buttons</Heading>
                <Card className="p-8">
                    <div className="flex flex-wrap gap-4 items-center mb-8">
                        <Button variant="primary" onClick={toggleLoading} isLoading={isLoading}>Primary Action</Button>
                        <Button variant="secondary">Secondary</Button>
                        <Button variant="outline">Outline</Button>
                        <Button variant="ghost">Ghost</Button>
                        <Button variant="destructive">Destructive</Button>
                    </div>
                    <div className="flex flex-wrap gap-4 items-center">
                        <Button size="sm">Small</Button>
                        <Button size="md">Medium</Button>
                        <Button size="lg">Large</Button>
                    </div>
                </Card>
            </section>

            <section className="space-y-6">
                <Heading level={2}>Badges</Heading>
                <Card className="p-8">
                    <div className="flex flex-wrap gap-4">
                        <Badge variant="default">Default</Badge>
                        <Badge variant="secondary">Secondary</Badge>
                        <Badge variant="outline">Outline</Badge>
                        <Badge variant="success">Success</Badge>
                        <Badge variant="warning">Warning</Badge>
                        <Badge variant="destructive">Destructive</Badge>
                        <Badge variant="info">Info</Badge>
                    </div>
                </Card>
            </section>

            <section className="space-y-6">
                <Heading level={2}>Cards</Heading>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Default Card</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Text>Standard card with seamless border and shadow used for most content.</Text>
                        </CardContent>
                    </Card>

                    <Card variant="glass">
                        <CardHeader>
                            <CardTitle>Glass Card</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Text>Frosted glass effect for floating panels and overlays.</Text>
                        </CardContent>
                    </Card>

                    <Card variant="plain">
                        <CardHeader>
                            <CardTitle>Plain Card</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Text>Minimal container without background, useful for grid layouts.</Text>
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section className="space-y-6">
                <Heading level={2}>Inputs</Heading>
                <Card className="p-8 max-w-md space-y-4">
                    <Input label="Email Address" placeholder="pilot@axis.com" />
                    <Input label="Password" type="password" placeholder="••••••••" />
                    <Input label="Error State" placeholder="Invalid input" error="This field is required" />
                </Card>
            </section>
        </div>
    );
};

export default StitchShowcase;
