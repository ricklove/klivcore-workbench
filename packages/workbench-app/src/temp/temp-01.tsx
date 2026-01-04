export const defaultProps = {
  id: "temp-01",
  data: `temp-data`,
  expandInfo: `temp-02`,
  nodeToDocument: () => `temp-03`,
};

export const Component = ({
  id,
  data,
  expandInfo,
  nodeToDocument,
}: {
  id: string;
  data: string;
  expandInfo: string;
  nodeToDocument: () => string;
}) => {
  return (
    <div className="flex flex-col flex-1 p-1 text-xs bg-blue-200 border border-blue-800 rounded nowheel nodrag nopan">
      <div className="flex flex-row items-center justify-between gap-1 p-0.5">
        <div>{id}</div>
        <div>{data.typeName}</div>
        <div
          className={`flex h-4 w-4 cursor-pointer flex-row items-center justify-center ${
            `` //`rounded border border-white p-1 text-white`
          } ${
            `` //expandInfo ? `bg-blue-800` : `bg-blue-400`
          }`}
          onClick={() => {
            setExpandInfo(false);
          }}
        >
          ✖
        </div>
      </div>
      <textarea
        className="min-h-[200px] flex-1 resize-none bg-white p-1"
        value={JSON.stringify(
          expandInfo === `data`
            ? data
            : nodeToDocument({
                id,
                typeName: data.typeName,
                data,
              }),
          null,
          2
        )}
        readOnly
      />
    </div>
  );
};
