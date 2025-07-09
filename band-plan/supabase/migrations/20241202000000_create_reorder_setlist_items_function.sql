drop function if exists reorder_setlist_items(setlist_item_update[], uuid);
drop type if exists setlist_item_update;

create type setlist_item_update as (
    item_id uuid,
    item_type text,
    new_position integer
);

create or replace function reorder_setlist_items(p_items setlist_item_update[], p_setlist_id uuid)
returns void as $$
declare
    item_update setlist_item_update;
    -- A large offset to prevent unique constraint violations during intermediate updates.
    -- This assumes that a setlist will not have more than 10000 items.
    position_offset integer := 10000; 
begin
    -- First, update all items to a temporary position to avoid conflicts.
    -- We add a large offset to their final intended position.
    foreach item_update in array p_items
    loop
        if item_update.item_type = 'song' then
            update setlist_songs
            set position = item_update.new_position + position_offset
            where setlist_id = p_setlist_id and id = item_update.item_id;
        elsif item_update.item_type = 'medley' then
            -- Medleys are updated just by their own ID, not setlist_id
            update medleys
            set position = item_update.new_position + position_offset
            where id = item_update.item_id;
        end if;
    end loop;

    -- Now that all items are in temporary, non-conflicting positions,
    -- update them to their final positions by removing the offset.
    foreach item_update in array p_items
    loop
        if item_update.item_type = 'song' then
            update setlist_songs
            set position = item_update.new_position
            where setlist_id = p_setlist_id and id = item_update.item_id;
        elsif item_update.item_type = 'medley' then
            -- Medleys are updated just by their own ID
            update medleys
            set position = item_update.new_position
            where id = item_update.item_id;
        end if;
    end loop;
end;
$$ language plpgsql; 