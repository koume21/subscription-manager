import { APP_NAME } from "@subs/shared/schemas";
import { redirect } from "next/navigation";

export default function Home() {
    redirect("/login");
}
