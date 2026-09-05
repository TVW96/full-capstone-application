import { Suspense } from "react";
import Footer from "@/components/Footer";
import SuccessClient from "./SuccessClient";

export default function CheckoutSuccessPage() { return <><Suspense fallback={<main id="main-content">Confirming your order…</main>}><SuccessClient /></Suspense><Footer /></>; }
