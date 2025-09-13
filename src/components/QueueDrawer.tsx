import React from 'react';
import { usePlayerStore } from '@/store/playerStore'; // Corrected import
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Play, Trash2, ListMusic, X, GripVertical, HeadphonesIcon, Youtube } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd'; // Corrected import path

export const QueueDrawer: React.FC = () => {
  const {
    queue,
    current,
    queueVisible,
    toggleQueueVisibility,
    play,
    removeFromQueue,
    reorderQueue,
    clearQueue,
  } = usePlayerStore();

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    reorderQueue(result.source.index, result.destination.index);
  };

  return (
    <Drawer open={queueVisible} onOpenChange={toggleQueueVisibility}>
      <DrawerContent className="h-[80vh] mt-24">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <ListMusic className="h-6 w-6" />
            Up Next ({queue.length})
          </DrawerTitle>
          <DrawerDescription>
            Your unified playback queue for videos and podcasts.
          </DrawerDescription>
        </DrawerHeader>
        <div className="p-4 flex-1 flex flex-col">
          {queue.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <p>Your queue is empty.</p>
              <p className="text-sm mt-2">Add videos or podcasts to start building your playlist!</p>
            </div>
          ) : (
            <>
              <ScrollArea className="flex-1 pr-4">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="queue">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                        {queue.map((item, index) => (
                          <Draggable key={item.id} draggableId={item.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg border bg-card transition-colors",
                                  current?.id === item.id && "border-primary ring-2 ring-primary/50",
                                  snapshot.isDragging && "shadow-lg bg-accent/10"
                                )}
                              >
                                <div {...provided.dragHandleProps} className="cursor-grab text-muted-foreground hover:text-foreground">
                                  <GripVertical className="h-5 w-5" />
                                </div>
                                <div className="relative w-16 h-10 flex-shrink-0">
                                  <img
                                    src={item.thumbnailUrl}
                                    alt={item.title}
                                    className="w-full h-full rounded object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-xs font-medium rounded">
                                    {item.type === 'video' ? <Youtube className="h-4 w-4" /> : <HeadphonesIcon className="h-4 w-4" />}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm line-clamp-1">{item.title}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    {item.type === 'video' ? item.channelTitle : item.creator} • {formatDuration(item.durationSeconds)}
                                  </p>
                                  {item.lastPositionSeconds && item.lastPositionSeconds > 0 && (
                                    <p className="text-xs text-primary mt-1">
                                      Resumes at {formatDuration(item.lastPositionSeconds)}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => play(item, item.lastPositionSeconds || 0)}
                                    title="Play Now"
                                  >
                                    <Play className="h-5 w-5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeFromQueue(item.id)}
                                    title="Remove from queue"
                                  >
                                    <Trash2 className="h-5 w-5" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </ScrollArea>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={clearQueue}>Clear Queue</Button>
                <Button onClick={toggleQueueVisibility}>Close</Button>
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};