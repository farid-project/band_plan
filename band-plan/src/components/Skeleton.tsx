import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
  count?: number;
}

export function Skeleton({ 
  className = '', 
  width = '100%', 
  height = '1rem', 
  rounded = false,
  count = 1 
}: SkeletonProps) {
  const skeletonItems = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={`
        animate-pulse bg-gray-200 
        ${rounded ? 'rounded-full' : 'rounded'} 
        ${className}
        ${count > 1 && index < count - 1 ? 'mb-2' : ''}
      `}
      style={{ width, height }}
    />
  ));

  return count === 1 ? skeletonItems[0] : <div>{skeletonItems}</div>;
}

// Skeleton específicos para diferentes componentes
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="grid grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
        <Skeleton height="1rem" />
        <Skeleton height="1rem" />
        <Skeleton height="1rem" />
        <Skeleton height="1rem" />
        <Skeleton height="1rem" />
        <Skeleton height="1rem" />
      </div>
      
      {/* Rows skeleton */}
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid grid-cols-6 gap-4 p-4 border-b">
          <Skeleton height="1rem" />
          <Skeleton height="1rem" />
          <Skeleton height="1rem" />
          <Skeleton height="1rem" />
          <Skeleton height="1rem" />
          <div className="flex gap-2">
            <Skeleton width="3rem" height="1rem" />
            <Skeleton width="4rem" height="1rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-white rounded-lg shadow p-6">
          <Skeleton height="1.5rem" className="mb-4" />
          <Skeleton height="1rem" className="mb-2" />
          <Skeleton height="1rem" width="70%" className="mb-4" />
          <div className="flex justify-between items-center">
            <Skeleton width="4rem" height="1rem" />
            <Skeleton width="3rem" height="1rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: items }, (_, index) => (
        <div key={index} className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
          <Skeleton width="3rem" height="3rem" rounded />
          <div className="flex-1">
            <Skeleton height="1.25rem" className="mb-2" />
            <Skeleton height="1rem" width="60%" />
          </div>
          <Skeleton width="5rem" height="2rem" />
        </div>
      ))}
    </div>
  );
}

export function EventSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <Skeleton height="1.5rem" width="60%" className="mb-2" />
              <div className="flex items-center gap-4">
                <Skeleton height="1rem" width="8rem" />
                <Skeleton height="1rem" width="6rem" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton width="3rem" height="2rem" />
              <Skeleton width="3rem" height="2rem" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Skeleton height="1rem" width="10rem" />
            <Skeleton height="1rem" width="8rem" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MemberSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="p-3 hover:bg-gray-50 border-b">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Skeleton height="1.25rem" width="8rem" />
                <Skeleton height="1rem" width="4rem" />
              </div>
              <div className="flex flex-wrap gap-1">
                <Skeleton height="1.5rem" width="5rem" />
                <Skeleton height="1.5rem" width="6rem" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton width="3rem" height="1.5rem" />
              <Skeleton width="4rem" height="1.5rem" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchResultSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
          <Skeleton width="3rem" height="3rem" />
          <div className="flex-1">
            <Skeleton height="1.25rem" className="mb-1" />
            <Skeleton height="1rem" width="70%" />
          </div>
          <Skeleton width="4rem" height="2rem" />
        </div>
      ))}
    </div>
  );
}