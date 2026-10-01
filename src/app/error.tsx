"use client";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/inline-error";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="page-container error-page"><h1>화면을 불러오지 못했어요</h1><InlineError message="잠시 후 다시 시도해 주세요. 문제가 계속되면 페이지를 새로고침해 주세요." /><Button onClick={reset}>다시 시도</Button></div>;
}
