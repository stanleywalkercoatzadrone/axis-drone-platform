import React from "react";
import * as Icons from "lucide-react";
import { LucideProps } from "lucide-react";

interface IconProps extends LucideProps {
    name: keyof typeof Icons;
}

const Icon: React.FC<IconProps> = ({ name, ...props }) => {
    // @ts-ignore - Dynamic icon loading from all exports
    const IconComponent = Icons[name] as React.FC<LucideProps>;

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in lucide-react`);
        return null;
    }

    return <IconComponent {...props} />;
};

export default Icon;
