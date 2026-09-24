import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  getPaginationRange,
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "./pagination";

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  tags: ["autodocs"],
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledPager({ pageCount }: { pageCount: number }) {
  const [page, setPage] = useState(1);
  const range = getPaginationRange({ page, pageCount });
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            disabled={page === 1}
            onClick={(event) => {
              event.preventDefault();
              setPage((current) => Math.max(1, current - 1));
            }}
          />
        </PaginationItem>
        {range.map((item) =>
          typeof item === "number" ? (
            <PaginationItem key={item}>
              <PaginationLink
                href="#"
                isActive={item === page}
                onClick={(event) => {
                  event.preventDefault();
                  setPage(item);
                }}
              >
                {item}
              </PaginationLink>
            </PaginationItem>
          ) : (
            <PaginationItem key={item}>
              <PaginationEllipsis />
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            href="#"
            disabled={page === pageCount}
            onClick={(event) => {
              event.preventDefault();
              setPage((current) => Math.min(pageCount, current + 1));
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

/** State lives in the story: click a page, Previous or Next to move the current page. */
export const Controlled: Story = {
  render: () => <ControlledPager pageCount={5} />,
};

/** `getPaginationRange` collapses the middle of a long list of pages behind ellipses. */
export const ManyPages: Story = {
  render: () => <ControlledPager pageCount={42} />,
};
