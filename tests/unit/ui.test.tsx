import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineError } from "@/components/ui/inline-error";
import { Button } from "@/components/ui/button";
import { TypographyCover } from "@/components/work/typography-cover";

describe("accessible foundation components", () => {
  it("keeps a next action in the empty state", async () => {
    const onClick = vi.fn();
    render(<EmptyState title="아직 기록이 없어요" description="첫 작품을 찾아보세요." action={<Button onClick={onClick}>작품 찾기</Button>} />);
    expect(screen.getByRole("heading", { name: "아직 기록이 없어요" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "작품 찾기" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
  it("announces inline errors", () => {
    render(<InlineError message="입력을 확인해 주세요." />);
    expect(screen.getByRole("alert")).toHaveTextContent("입력을 확인해 주세요.");
  });
  it("renders arbitrary titles as accessible text, never HTML", () => {
    render(<TypographyCover title="<script>예시</script>" />);
    expect(screen.getByRole("img")).toHaveAccessibleName("<script>예시</script> 텍스트 표지");
    expect(document.querySelector("script")).toBeNull();
  });
});
