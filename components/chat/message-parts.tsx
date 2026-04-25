/* eslint-disable @typescript-eslint/ban-ts-comment */
"use client";

import {
  ChatStatus,
  DynamicToolUIPart,
  StepStartUIPart,
  ToolUIPart,
  UIMessage,
} from "ai";

import { TextShimmer } from "../ui/text-shimmer";
import { Response } from "../ai-elements/response";

type MessagePart = UIMessage["parts"][number];
type ToolLikeUIPart = ToolUIPart | DynamicToolUIPart;

const GATHERING_TEXT = "Gathering information...";


const isStepStartPart = (part?: MessagePart): part is StepStartUIPart =>
  !!part && typeof part.type === "string" && part.type === "step-start";

const isToolLikePart = (part?: MessagePart): part is ToolLikeUIPart =>
  !!part &&
  typeof part.type === "string" &&
  (part.type === "dynamic-tool" || part.type.startsWith("tool-"));

const isRenderableTextPart = (part?: MessagePart) =>
  part?.type === "text" &&
  (part.text === "Thinking..." || part.text.trim().length > 0);

const isRenderableReasoningPart = (
  part: MessagePart | undefined,
) => part?.type === "reasoning" && part.text.trim().length > 0;

const isRenderableDataPart = (part?: MessagePart) =>
  !!part &&
  typeof part.type === "string" &&
  part.type.startsWith("data-") &&
  "data" in part &&
  !!part.data &&
  typeof part.data === "object" &&
  part.data !== null &&
  Object.keys(part.data).length > 0;

const hasRenderableContentAfter = (
  parts: MessagePart[],
  startIndex: number,
) => {
  for (let index = startIndex + 1; index < parts.length; index += 1) {
    const candidate = parts[index];

    const isRenderablePart =
      isRenderableTextPart(candidate) ||
      isRenderableReasoningPart(candidate) ||
      isRenderableDataPart(candidate);

    if (isRenderablePart) {
      return true;
    }
  }

  return false;
};

const shouldShowToolLoading = (
  parts: MessagePart[],
  part: ToolLikeUIPart,
  index: number,
) => {

  return !hasRenderableContentAfter(parts, index);
};

const findNearestToolNeighbor = (
  parts: MessagePart[],
  startIndex: number,
  direction: -1 | 1
) => {
  let cursor = startIndex + direction;

  while (cursor >= 0 && cursor < parts.length) {
    const candidate = parts[cursor];

    if (!candidate || candidate.type === "step-start") {
      cursor += direction;
      continue;
    }

    if (isToolLikePart(candidate)) {
      return { part: candidate, index: cursor };
    }

    break;
  }

  return null;
};

const shouldShowStepStartLoading = (
  parts: MessagePart[],
  index: number,
) => {
  const previousTool = findNearestToolNeighbor(parts, index, -1);
  if (
    previousTool &&
    shouldShowToolLoading(
      parts,
      previousTool.part,
      previousTool.index,
    )
  ) {
    return false;
  }

  const nextTool = findNearestToolNeighbor(parts, index, 1);
  if (
    nextTool &&
    shouldShowToolLoading(parts, nextTool.part, nextTool.index)
  ) {
    return false;
  }

  return !hasRenderableContentAfter(parts, index);
};


interface MessagePartProps {
  parts: UIMessage["parts"];
  messageId: string;
  status?: ChatStatus;
}

export const MessageParts = ({
  parts,
  messageId,
  status,
}: MessagePartProps) => {
  const isChatStreaming = status === "streaming";
  const messageParts = parts ?? [];

  return (
    <div>
      {messageParts.map((part, index) => {
        const { type } = part;
        const key = `message-${messageId}-part-${index}`;

        if (status === "streaming" || (type === "text" && part.text === "Thinking...")) {
          return <TextShimmer duration={10} key={key}>Thinking...</TextShimmer>;
        }

        if (type === "text") {
          return (
            <div className="markdown" key={key}>
              <Response>{part.text}</Response>
            </div>
          );
        }

        // if (type === "reasoning" && enableReasoning) {
        //   markContentRendered();
        //   return (
        //     <div className="w-full my-2" key={key}>
        //       <Reasoning
        //         className="w-full"
        //         isStreaming={part.state === "streaming"}
        //       >
        //         <ReasoningTrigger />
        //         <ReasoningContent>{part.text}</ReasoningContent>
        //       </Reasoning>
        //     </div>
        //   );
        // }

        if (!isChatStreaming) return null;

        return null;
      })}
    </div>
  );
};
