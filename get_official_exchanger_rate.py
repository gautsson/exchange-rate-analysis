from xml.etree import ElementTree
import requests, datetime, csv, collections

def get_last_row(csv_filename):
    try:
        with open(csv_filename, "r") as f:
            csv_reader = csv.reader(f)
            first_line = next(csv_reader) # so we throw an indexerror if file has only 1 line
            last_line = collections.deque(csv.reader(f), 1)[0]
            return last_line
    except StopIteration: # file is empty
        return ["1950-01-01 12:00:00"]
    except IndexError:  # file only has headings (i.e. one line)
        return ["1950-01-01 12:00:00"]
    except FileNotFoundError: # create new file
        file = open(csv_filename, "w")
        file.write("date,exchange_rate\n")
        file.close()
        return ["1950-01-01 12:00:00"]

def get_request(from_date, to_date, filename):
    endpoint_url = "http://www.sedlabanki.is/xmltimeseries/Default.aspx?DagsFra=" + from_date + "&DagsTil=" + date_to + "T23:59:59&TimeSeriesID=4110&Type=xml"
    r = requests.get(endpoint_url)

    if r.status_code == 200:
        write_time_file(filename, r.content)
    else:
        print("Error: " + r.text)

def write_time_file(filename, data):
    file = open(filename, "a")
    answer_data = ElementTree.fromstring(data)
 
    for element in answer_data.findall("./TimeSeries/TimeSeriesData/Entry"):
        date = datetime.datetime.strptime(element[0].text, "%m/%d/%Y %H:%M:%S %p").strftime("%Y-%m-%d %H:%M:%S")
        value = element[1].text
        result = date + "," + value + "\n"
        file.write(result)
    file.close()

if __name__ == "__main__":
    filename = "data/official_sek_isk.csv"
    last_recorded_timestamp = datetime.datetime.strptime(get_last_row(filename)[0], "%Y-%m-%d %H:%M:%S").strftime("%Y-%m-%d")
  
    # date from is the last date we have a value for (plus one day so we don't get the same value twice)
    date_from = (datetime.datetime.strptime(last_recorded_timestamp, "%Y-%m-%d") + datetime.timedelta(days=1)).strftime("%Y-%m-%d")
    date_to = datetime.datetime.now().strftime("%Y-%m-%d")

    get_request(date_from, date_to, filename)